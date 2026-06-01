import { Router } from 'express'
import { fetchWithCache, TTL, getBudgetStatus } from '../cacheManager.js'
import { ll2, LL2_BASE } from '../lib/ll2Client.js'

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

/**
 * GET /api/launches/history/chart
 * Fetches ALL matching launches (every page) for chart rendering.
 * Strategy: fetch page 1 to learn the total count, then fetch all remaining
 * pages in parallel batches of 5 so the full dataset lands quickly.
 * Result is cached 24 hr — past launches never change.
 */
router.get('/history/chart', async (req, res) => {
  const {
    agency = '', rocket = '', outcome = '', orbit = '',
    date_from = '', date_to = '',
    sort = 'net', sort_desc = 'true',
  } = req.query

  const ordering = `${sort_desc === 'true' ? '-' : ''}${SORT_MAP[sort] || 'net'}`
  const cacheKey = `history_chart_v2_${[agency, rocket, outcome, orbit, date_from, date_to, ordering].join('|')}`

  try {
    const { data, fromCache, stale, budget } = await fetchWithCache(
      cacheKey,
      async () => {
        const PAGE_SIZE  = 100
        const BATCH_SIZE = 5   // concurrent LL2 requests per round

        function buildParams(offset) {
          const p = new URLSearchParams({
            mode: 'normal', limit: String(PAGE_SIZE),
            offset: String(offset), ordering,
          })
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

        // Page 1 → learn the total count
        const { data: first } = await ll2.getUrl(`${LL2_BASE}/launch/?${buildParams(0)}`)
        const total   = first.count ?? 0
        const results = [...(first.results ?? [])]

        if (total > PAGE_SIZE) {
          // Build the full list of remaining page offsets
          const offsets = []
          for (let off = PAGE_SIZE; off < total; off += PAGE_SIZE) offsets.push(off)

          // Fetch in parallel batches — keeps wire time low while respecting LL2
          for (let i = 0; i < offsets.length; i += BATCH_SIZE) {
            const batch = offsets.slice(i, i + BATCH_SIZE)
            const pages = await Promise.all(
              batch.map(off =>
                ll2.getUrl(`${LL2_BASE}/launch/?${buildParams(off)}`)
                   .then(r => r.data.results ?? [])
              )
            )
            results.push(...pages.flat())
          }
        }

        return { results, count: total }
      },
      { fresh: TTL.HISTORY, stale: TTL.HISTORY * 2 },
    )

    return res.json({
      ...data,
      _meta: { fetchedAt: new Date().toISOString(), source: 'LL2 v2.2.0', fromCache, stale, budget },
    })
  } catch (err) {
    if (err.isRateLimit) return rateLimitResponse(res, err)
    console.error('[History/Chart]', err.response?.status, err.message)
    res.status(502).json({ error: 'fetch_failed', message: err.message })
  }
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
