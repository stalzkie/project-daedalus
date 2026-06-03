import { Router } from 'express'
import { fetchWithCache, cacheRead, cacheWrite, readAllCachesMatching, recordRequest, getBudgetStatus, TTL } from '../cacheManager.js'
import { ll2, LL2_BASE } from '../lib/ll2Client.js'

// ─── Running chart-stats accumulator ─────────────────────────────────────────
// Stores { yearAgencyMap, payloadScatter, seenIds, total } across all unfiltered
// history pages that have been served. Updates are fire-and-forget.

const CHART_STATS_KEY = 'chart_stats_v1'

function getChartStatsOrEmpty() {
  return cacheRead(CHART_STATS_KEY, Infinity, Infinity)?.data ?? {
    yearAgencyMap: {}, payloadScatter: [], seenIds: {}, total: 0,
  }
}

function ingestIntoStats(stats, launch) {
  if (!launch?.id || stats.seenIds[launch.id]) return
  stats.seenIds[launch.id] = 1

  const year = new Date(launch.net).getFullYear()
  if (!year || isNaN(year)) return
  const ag = launch.launch_service_provider?.abbrev
          || launch.launch_service_provider?.name
          || 'Unknown'
  const key = `${ag}||${year}`
  if (!stats.yearAgencyMap[key])
    stats.yearAgencyMap[key] = { agency: ag, year, total: 0, success: 0 }
  stats.yearAgencyMap[key].total++
  if (launch.status?.abbrev === 'Success') stats.yearAgencyMap[key].success++

  const leo = launch.rocket?.configuration?.leo_capacity
           ?? launch.rocket?.configuration?.payload_leo_kg
  const orb = launch.mission?.orbit?.abbrev
  if (leo != null && orb && ORBIT_APOGEE[orb] != null) {
    stats.payloadScatter.push({
      id: launch.id, name: launch.name,
      agency: launch.launch_service_provider?.name || 'Unknown',
      orbitAbbrev: orb, leoCapacity: leo, apogee: ORBIT_APOGEE[orb],
      status: launch.status?.abbrev ?? null,
    })
  }
}

function updateChartStats(launches, total) {
  setImmediate(() => {
    try {
      const stats = getChartStatsOrEmpty()
      let changed = false
      for (const l of launches) {
        const before = Object.keys(stats.seenIds).length
        ingestIntoStats(stats, l)
        if (Object.keys(stats.seenIds).length !== before) changed = true
      }
      if (total && total > stats.total) { stats.total = total; changed = true }
      if (changed) cacheWrite(CHART_STATS_KEY, stats)
    } catch (e) {
      console.warn('[ChartStats] update failed:', e.message)
    }
  })
}

/**
 * Bootstrap: scan existing unfiltered history cache files on first chart request
 * so data is available even before the user has browsed the table in the current session.
 */
function bootstrapChartStats() {
  try {
    const all = readAllCachesMatching('history_mode_detailed_')
    // Only unfiltered pages: filenames that don't contain filter markers
    const unfiltered = all.filter(e =>
      !e.file.includes('icontains') &&
      !e.file.includes('status__abbrev')
    )
    if (!unfiltered.length) return

    // Dedupe by offset — take the most recent version of each page
    const byOffset = {}
    for (const e of unfiltered) {
      if (e.offset < 0) continue
      if (!byOffset[e.offset] || e.ts > byOffset[e.offset].ts) byOffset[e.offset] = e
    }

    const stats = getChartStatsOrEmpty()
    let total = stats.total
    let changed = false
    for (const { data } of Object.values(byOffset)) {
      if (data?.count && data.count > total) { total = data.count; changed = true }
      for (const l of (data?.results ?? [])) {
        const before = Object.keys(stats.seenIds).length
        ingestIntoStats(stats, l)
        if (Object.keys(stats.seenIds).length !== before) changed = true
      }
    }
    if (changed) { stats.total = total; cacheWrite(CHART_STATS_KEY, stats) }
  } catch (e) {
    console.warn('[ChartStats] bootstrap failed:', e.message)
  }
}

const router  = Router()

const SORT_MAP = {
  net:    'net',
  name:   'name',
  agency: 'launch_service_provider__name',
  rocket: 'rocket__configuration__name',
  orbit:  'mission__orbit__abbrev',
  status: 'status__abbrev',
}

function rateLimitResponse(res, err) {
  return res.status(429).json({ error: 'rate_limit', message: err.message, budget: err.budget })
}

// Approximate apogee km by orbit class (mirrors client-side constant)
const ORBIT_APOGEE = {
  VLEO: 350, LEO: 408, ISS: 408, SSO: 550, POLAR: 600,
  MEO: 20200, GTO: 35786, GEO: 35786, HEO: 40000, TLI: 384400, BEO: 600000,
}

/**
 * GET /api/launches/history/chart
 * Returns pre-aggregated stats for the charts.
 *
 * Strategy (in order — first that yields data wins):
 *  1. Running chart_stats_v1 file (updated write-through by the history table endpoint)
 *  2. Bootstrap: scan unfiltered history cache files that are already on disk
 *  3. LL2 live fetch (rate-limit tolerant, returns partial data if limit hit)
 *
 * Response: { byYearAgency, payloadScatter, total, fetched, partial }
 */
router.get('/history/chart', async (req, res) => {
  const { agency = '', rocket = '', outcome = '', orbit = '', date_from = '', date_to = '' } = req.query
  const isUnfiltered = !agency && !rocket && !outcome && !orbit && !date_from && !date_to

  // ── 1. Running stats file (populated by the history table endpoint) ────────
  if (isUnfiltered) {
    let stats = getChartStatsOrEmpty()

    // If stats are empty (first ever visit), run the bootstrap scan now
    if (Object.keys(stats.seenIds).length === 0) bootstrapChartStats()

    // Re-read after potential bootstrap
    stats = getChartStatsOrEmpty()
    const fetched = Object.keys(stats.seenIds).length

    if (fetched > 0) {
      return res.json({
        byYearAgency:  Object.values(stats.yearAgencyMap),
        payloadScatter: stats.payloadScatter,
        total:          stats.total || fetched,
        fetched,
        partial:        stats.total > 0 && fetched < stats.total,
        _meta: { fromStats: true, fetchedAt: new Date().toISOString(), budget: getBudgetStatus() },
      })
    }
  }

  // ── 2. LL2 live fetch for filtered queries or when no cached data exists ───
  const { sort = 'net', sort_desc = 'true' } = req.query
  const ordering = `${sort_desc === 'true' ? '-' : ''}${SORT_MAP[sort] || 'net'}`

  const budgetNow = getBudgetStatus()
  if (!budgetNow.canFetch) {
    return res.json({
      byYearAgency: [], payloadScatter: [], total: 0, fetched: 0, partial: true,
      _meta: { rateLimit: true, budget: budgetNow, fetchedAt: new Date().toISOString() },
    })
  }

  const PAGE_SIZE = 100, BATCH_SIZE = 5
  const yearAgencyMap = {}, payloadScatter = [], seenIds = new Set()
  let total = 0, partial = false

  function buildParams(offset) {
    const p = new URLSearchParams({ mode: 'normal', limit: String(PAGE_SIZE), offset: String(offset), ordering })
    p.set('net__lte', date_to || new Date().toISOString())
    if (date_from) p.set('net__gte', date_from)
    if (agency)    p.set('launch_service_provider__name__icontains', agency)
    if (rocket)    p.set('rocket__configuration__name__icontains', rocket)
    if (orbit)     p.set('mission__orbit__abbrev', orbit)
    if (outcome === 'success')  p.set('status__abbrev', 'Success')
    else if (outcome === 'failure') p.set('status__abbrev', 'Failure')
    else if (outcome === 'partial') p.set('status__abbrev', 'Partial Failure')
    return p
  }

  function ingestLocal(launch) {
    if (!launch?.id || seenIds.has(launch.id)) return
    seenIds.add(launch.id)
    const year = new Date(launch.net).getFullYear()
    if (!year || isNaN(year)) return
    const ag = launch.launch_service_provider?.abbrev || launch.launch_service_provider?.name || 'Unknown'
    const key = `${ag}||${year}`
    if (!yearAgencyMap[key]) yearAgencyMap[key] = { agency: ag, year, total: 0, success: 0 }
    yearAgencyMap[key].total++
    if (launch.status?.abbrev === 'Success') yearAgencyMap[key].success++
    const leo = launch.rocket?.configuration?.leo_capacity ?? launch.rocket?.configuration?.payload_leo_kg
    const orb = launch.mission?.orbit?.abbrev
    if (leo != null && orb && ORBIT_APOGEE[orb] != null)
      payloadScatter.push({ id: launch.id, name: launch.name, agency: launch.launch_service_provider?.name || 'Unknown', orbitAbbrev: orb, leoCapacity: leo, apogee: ORBIT_APOGEE[orb], status: launch.status?.abbrev ?? null })
  }

  try {
    recordRequest()
    const { data: first } = await ll2.getUrl(`${LL2_BASE}/launch/?${buildParams(0)}`)
    total = first.count ?? 0
    ;(first.results ?? []).forEach(ingestLocal)
    if (total > PAGE_SIZE) {
      const offsets = []
      for (let o = PAGE_SIZE; o < total; o += PAGE_SIZE) offsets.push(o)
      for (let i = 0; i < offsets.length; i += BATCH_SIZE) {
        if (!getBudgetStatus().canFetch) { partial = true; break }
        try {
          recordRequest()
          const pages = await Promise.all(offsets.slice(i, i + BATCH_SIZE).map(o =>
            ll2.getUrl(`${LL2_BASE}/launch/?${buildParams(o)}`).then(r => r.data.results ?? []).catch(() => [])
          ))
          pages.flat().forEach(ingestLocal)
        } catch { partial = true; break }
      }
    }
  } catch (err) {
    if (err.isRateLimit) return rateLimitResponse(res, err)
    console.error('[History/Chart]', err.response?.status, err.message)
    return res.status(502).json({ error: 'fetch_failed', message: err.message })
  }

  return res.json({
    byYearAgency: Object.values(yearAgencyMap), payloadScatter, total, fetched: seenIds.size, partial,
    _meta: { fromCache: false, fetchedAt: new Date().toISOString(), budget: getBudgetStatus() },
  })
})

/**
 * GET /api/launches/history
 * History queries are cached 24 hr — past launches never change.
 */
router.get('/history', async (req, res) => {
  const {
    page = 1, limit = 50,
    agency = '', rocket = '', outcome = '', orbit = '',
    date_from = '', date_to = '',
    sort = 'net', sort_desc = 'true',
  } = req.query

  const offset   = (parseInt(page) - 1) * parseInt(limit)
  const ordering = `${sort_desc === 'true' ? '-' : ''}${SORT_MAP[sort] || 'net'}`

  const params = new URLSearchParams({
    mode: 'detailed', limit: String(Math.min(parseInt(limit), 100)),
    offset: String(offset), ordering,
  })
  params.set('net__lte', date_to || new Date().toISOString())
  if (date_from) params.set('net__gte', date_from)
  if (agency)    params.set('launch_service_provider__name__icontains', agency)
  if (rocket)    params.set('rocket__configuration__name__icontains', rocket)
  if (orbit)     params.set('mission__orbit__abbrev', orbit)
  if (outcome === 'success') params.set('status__abbrev', 'Success')
  else if (outcome === 'failure') params.set('status__abbrev', 'Failure')
  else if (outcome === 'partial') params.set('status__abbrev', 'Partial Failure')

  const url      = `${LL2_BASE}/launch/?${params}`
  const cacheKey = `history_${params.toString()}`

  try {
    const { data, fromCache, stale, budget } = await fetchWithCache(
      cacheKey,
      async () => {
        const { data } = await ll2.getUrl(url)
        return data
      },
      // Past data doesn't change — 24 hr fresh, serve stale up to 48 hr when rate-limited
      { fresh: TTL.HISTORY, stale: TTL.HISTORY * 2 },
    )

    // Write-through: accumulate chart stats from every unfiltered page we serve
    const isUnfilteredPage = !agency && !rocket && !outcome && !orbit && !date_from && !date_to
    if (isUnfilteredPage) updateChartStats(data.results ?? [], data.count)

    return res.json({
      ...data,
      _meta: { page: parseInt(page), limit: parseInt(limit), fetchedAt: new Date().toISOString(), source: 'LL2 v2.2.0', fromCache, stale, budget },
    })
  } catch (err) {
    if (err.isRateLimit) return rateLimitResponse(res, err)
    console.error('[History]', err.response?.status, err.message)
    res.status(502).json({ error: 'fetch_failed', message: err.message })
  }
})

/**
 * GET /api/launches/compare?ids=id1,id2,...
 * Individual past-launch records cached 7 days.
 */
router.get('/compare', async (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean).slice(0, 5)
  if (!ids.length) return res.status(400).json({ error: 'No IDs provided' })

  try {
    const launches = await Promise.all(ids.map(id =>
      fetchWithCache(
        `detail_${id}`,
        async () => {
          const { data } = await ll2.getUrl(`${LL2_BASE}/launch/${id}/`)
          return data
        },
        { fresh: TTL.DETAIL, stale: TTL.DETAIL * 7 },
      ).then(r => r.data)
    ))
    res.json({ launches, _meta: { fetchedAt: new Date().toISOString(), budget: getBudgetStatus() } })
  } catch (err) {
    if (err.isRateLimit) return rateLimitResponse(res, err)
    console.error('[Compare]', err.response?.status, err.message)
    res.status(502).json({ error: 'fetch_failed', message: err.message })
  }
})

/**
 * GET /api/launches/stats?rocket=Falcon+9
 * Aggregated success-rate stats, cached 24 hr.
 */
router.get('/stats', async (req, res) => {
  const { rocket } = req.query
  if (!rocket) return res.status(400).json({ error: 'rocket param required' })

  const cacheKey = `stats_${rocket}`

  try {
    const { data, fromCache, stale, budget } = await fetchWithCache(
      cacheKey,
      async () => {
        // Step 1: resolve rocket family name → config IDs (name filter is unreliable in LL2)
        const { data: cfgData } = await ll2.get('/config/launcher/', { search: rocket, limit: 15 })
        const configIds = (cfgData.results || []).map(c => c.id)
        if (!configIds.length) return { family: rocket, total: 0, stats: [] }

        // Step 2: fetch launches for those config IDs, all pages up to 300
        const allResults = []
        for (const cfgId of configIds.slice(0, 5)) {
          const params = new URLSearchParams({
            rocket__configuration__id: cfgId,
            net__lte: new Date().toISOString(),
            limit: '100', mode: 'list', ordering: '-net',
          })
          const { data: pageData } = await ll2.getUrl(`${LL2_BASE}/launch/?${params}`)
          allResults.push(...(pageData.results || []))
        }
        const data = { count: allResults.length, results: allResults }

        const yearMap = {}
        data.results.forEach(l => {
          const year = new Date(l.net).getFullYear()
          if (!yearMap[year]) yearMap[year] = { year, total: 0, success: 0, failure: 0, partial: 0 }
          yearMap[year].total++
          const a = l.status?.abbrev
          if (a === 'Success')          yearMap[year].success++
          else if (a === 'Failure')     yearMap[year].failure++
          else if (a === 'Partial Failure') yearMap[year].partial++
        })

        return {
          family: rocket,
          total: data.count,
          stats: Object.values(yearMap)
            .sort((a, b) => a.year - b.year)
            .map(y => ({ ...y, rate: y.total > 0 ? Math.round((y.success / y.total) * 100) : null })),
        }
      },
      { fresh: TTL.STATS, stale: TTL.STATS * 2 },
    )

    return res.json({ ...data, _meta: { fetchedAt: new Date().toISOString(), fromCache, stale, budget } })
  } catch (err) {
    if (err.isRateLimit) return rateLimitResponse(res, err)
    console.error('[Stats]', err.response?.status, err.message)
    res.status(502).json({ error: 'fetch_failed', message: err.message })
  }
})

export { router as historyRouter }
