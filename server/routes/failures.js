import { Router } from 'express'
import { cacheRead, cacheWrite, getBudgetStatus } from '../cacheManager.js'
import { getFailedLaunches } from '../lib/spaceTrackClient.js'
import { rateLimiter } from '../lib/spaceTrackRateLimiter.js'
import { logger } from '../lib/logger.js'

const router = Router()

const CACHE_KEY  = 'failures_processed'
const CACHE_TTL  = 24 * 60 * 60_000   // 24 hr — historical data doesn't change

// ─── Stage classification from orbital parameters ──────────────────────────
// SpaceTrack SATCAT doesn't have failure reason text, so we infer from orbit.

function classifyStage(obj) {
  const period  = obj.PERIOD  ? parseFloat(obj.PERIOD)  : null
  const perigee = obj.PERIGEE ? parseInt(obj.PERIGEE, 10) : null
  const apogee  = obj.APOGEE  ? parseInt(obj.APOGEE, 10)  : null

  if (period !== null && period < 70) return 'Stage 1 / Booster'       // never achieved orbit
  if (perigee !== null && perigee < 80) return 'Stage 2'               // barely above atmosphere
  if (perigee !== null && perigee < 150) return 'Upper Stage'          // low insertion orbit
  if (apogee  !== null && apogee  > 50_000) return 'Guidance & Navigation'  // wildly wrong orbit
  return 'Unknown / Under Investigation'
}

function buildProfile(obj, daysTillDecay) {
  const period = obj.PERIOD ? parseFloat(obj.PERIOD) : null
  // Suborbital (period < 88 min) or decayed in < 1 day → total loss
  const isTotal = (period !== null && period < 88) ||
                  (daysTillDecay !== null && daysTillDecay < 1)
  return {
    stage:     classifyStage(obj),
    isRUD:     false,   // SpaceTrack has no free-text reason to parse
    isFTS:     false,
    isPartial: !isTotal,
    severity:  isTotal ? 'total' : 'partial',
  }
}

// ─── Map SpaceTrack SATCAT record → failure record ─────────────────────────

// Rough country-code → agency / operator name
const COUNTRY_NAMES = {
  'US':  'NASA / USAF / Commercial (US)',
  'CIS': 'Soviet Union / Russia',
  'CN':  'China',
  'IN':  'ISRO (India)',
  'FR':  'Arianespace (France)',
  'JP':  'JAXA (Japan)',
  'IL':  'IAI (Israel)',
  'IR':  'Iran',
  'KR':  'KARI (South Korea)',
  'UK':  'United Kingdom',
  'BR':  'Brazil',
  'IT':  'Italy',
  'EU':  'ESA (Europe)',
}

function toFailureRecord(obj) {
  const launchDate = obj.LAUNCH ? new Date(obj.LAUNCH) : null
  const decayDate  = obj.DECAY  ? new Date(obj.DECAY)  : null
  const daysTillDecay = (launchDate && decayDate)
    ? (decayDate - launchDate) / 86_400_000
    : null

  const profile = buildProfile(obj, daysTillDecay)

  return {
    id:     obj.NORAD_CAT_ID ? `st-${obj.NORAD_CAT_ID}` : `st-${obj.INTERNATIONAL_DESIGNATOR}`,
    name:   [obj.OBJECT_NAME, obj.INTERNATIONAL_DESIGNATOR].filter(Boolean).join(' | '),
    net:    obj.LAUNCH || null,
    status: {
      id:    profile.isPartial ? 7 : 4,
      name:  profile.isPartial ? 'Partial Failure' : 'Launch Failure',
      abbrev:profile.isPartial ? 'Partial Failure' : 'Failure',
    },
    failreason:  '',   // SpaceTrack SATCAT has no free-text failure reason
    launch_service_provider: {
      name:   COUNTRY_NAMES[obj.COUNTRY] || obj.COUNTRY || 'Unknown',
      abbrev: obj.COUNTRY || '?',
    },
    rocket: {
      configuration: {
        family: obj.SITE ? `(${obj.SITE})` : 'Unknown',
        name:   obj.SITE || 'Unknown',
        leo_capacity: null, to_thrust: null, max_stage: null,
      },
    },
    mission: {
      orbit: {
        abbrev: deriveOrbitAbbrev(obj),
        name:   deriveOrbitAbbrev(obj),
      },
      description: buildDescription(obj, daysTillDecay),
    },
    pad: { name: obj.SITE || '—', location: { name: COUNTRY_NAMES[obj.COUNTRY] || obj.COUNTRY } },
    // Extra orbital context for the detail panel
    _satcat: {
      norad_id:    obj.NORAD_CAT_ID,
      int_desig:   obj.INTERNATIONAL_DESIGNATOR,
      period_min:  obj.PERIOD  ? parseFloat(obj.PERIOD)  : null,
      perigee_km:  obj.PERIGEE ? parseInt(obj.PERIGEE, 10) : null,
      apogee_km:   obj.APOGEE  ? parseInt(obj.APOGEE, 10)  : null,
      inclination: obj.INCLINATION ? parseFloat(obj.INCLINATION) : null,
      decay_date:  obj.DECAY || null,
      days_till_decay: daysTillDecay != null ? +daysTillDecay.toFixed(1) : null,
      country:     obj.COUNTRY,
      site:        obj.SITE,
    },
    failureProfile: profile,
  }
}

function deriveOrbitAbbrev(obj) {
  const period  = obj.PERIOD  ? parseFloat(obj.PERIOD)  : null
  const apogee  = obj.APOGEE  ? parseInt(obj.APOGEE, 10)  : null
  if (!period) return '?'
  if (period < 88)  return 'SUB'
  if (period < 100) return 'VLEO'
  if (period < 130) return 'LEO'
  if (period < 200) return 'MEO'
  if (apogee && apogee > 30_000) return 'GTO'
  return 'LEO'
}

function buildDescription(obj, days) {
  const parts = []
  if (obj.SITE) parts.push(`Launched from ${obj.SITE}`)
  if (obj.PERIGEE && obj.APOGEE)
    parts.push(`Orbit: ${obj.PERIGEE} × ${obj.APOGEE} km`)
  if (obj.PERIOD)
    parts.push(`Period: ${parseFloat(obj.PERIOD).toFixed(1)} min`)
  if (days != null)
    parts.push(`Decayed ${days.toFixed(1)} day${days !== 1 ? 's' : ''} after launch`)
  return parts.join(' · ')
}

// ─── Stats ─────────────────────────────────────────────────────────────────

function computeStats(failures) {
  const totalFailures = failures.filter(f => !f.failureProfile.isPartial).length
  const totalPartial  = failures.filter(f =>  f.failureProfile.isPartial).length

  const byDecade = {}
  const byStage  = {}
  const familyMap = {}
  const agencyMap = {}

  failures.forEach(f => {
    const year = f.net ? new Date(f.net).getFullYear() : null
    if (year && !isNaN(year)) {
      const decade = `${Math.floor(year / 10) * 10}s`
      if (!byDecade[decade]) byDecade[decade] = { decade, total: 0, partial: 0 }
      if (f.failureProfile.isPartial) byDecade[decade].partial++
      else byDecade[decade].total++
    }

    const stage  = f.failureProfile.stage
    byStage[stage] = (byStage[stage] || 0) + 1

    const family = f._satcat?.site || 'Unknown'
    familyMap[family] = (familyMap[family] || 0) + 1

    const agency = f.launch_service_provider?.abbrev || 'Unknown'
    agencyMap[agency] = (agencyMap[agency] || 0) + 1
  })

  return {
    totalFailures,
    totalPartial,
    rudCount: 0,
    ftsCount: 0,
    byDecade: Object.values(byDecade)
      .sort((a, b) => parseInt(a.decade) - parseInt(b.decade)),
    byStage,
    byFamily: Object.entries(familyMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, count]) => ({ name, count })),
    byAgency: Object.entries(agencyMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, count]) => ({ name, count })),
  }
}

function stError(res, err) {
  logger.error('[Failures]', err.message)
  return res.status(503).json({ error: 'spacetrack_error', message: err.message })
}

// ─── Routes ────────────────────────────────────────────────────────────────

router.get('/all', async (req, res) => {
  try {
    // Check processed cache first (avoids re-normalising every request)
    const cached = cacheRead(CACHE_KEY, CACHE_TTL)
    if (cached?.fresh || cached?.stale) {
      return res.json({
        results: cached.data,
        count:   cached.data.length,
        _meta: { fetchedAt: new Date().toISOString(), source: 'Space-Track SATCAT', fromCache: true },
      })
    }

    const raw      = await getFailedLaunches()
    const failures = raw.map(toFailureRecord)
                        .sort((a, b) => (b.net || '') > (a.net || '') ? 1 : -1)
    cacheWrite(CACHE_KEY, failures)

    return res.json({
      results: failures,
      count:   failures.length,
      _meta: { fetchedAt: new Date().toISOString(), source: 'Space-Track SATCAT', fromCache: false },
    })
  } catch (err) {
    return stError(res, err)
  }
})

router.get('/stats', async (req, res) => {
  try {
    const cached = cacheRead(CACHE_KEY, CACHE_TTL)
    let failures

    if (cached?.fresh || cached?.stale) {
      failures = cached.data
    } else {
      const raw = await getFailedLaunches()
      failures  = raw.map(toFailureRecord)
      cacheWrite(CACHE_KEY, failures)
    }

    const stats = computeStats(failures)

    // Best-effort total launch count for failure rate (use a rough estimate if no data)
    const failureRate = +((( stats.totalFailures + stats.totalPartial ) / Math.max(1, failures.length + 5800)) * 100).toFixed(2)

    return res.json({
      ...stats,
      totalAttempts: null,
      failureRate,
      _meta: { fetchedAt: new Date().toISOString(), source: 'Space-Track SATCAT' },
    })
  } catch (err) {
    return stError(res, err)
  }
})

router.get('/:id', async (req, res) => {
  const { id } = req.params
  try {
    const cached = cacheRead(CACHE_KEY, CACHE_TTL)
    if (cached?.fresh || cached?.stale) {
      const record = cached.data.find(f => f.id === id)
      if (record) return res.json({ ...record, _meta: { source: 'Space-Track SATCAT' } })
    }
    return res.status(404).json({ error: 'not_found', message: `Failure record ${id} not found. Fetch /api/failures/all first.` })
  } catch (err) {
    return stError(res, err)
  }
})

export { router as failuresRouter }
