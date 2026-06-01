/**
 * TLE / Space-Track routes.
 *
 * Mounted at /api/tle in server/index.js
 *
 * IMPORTANT: static path segments (status, satcat, lookup) must be
 * declared BEFORE /:noradId to prevent Express from matching them
 * as dynamic noradId values.
 */

import { Router } from 'express'
import * as satellite from 'satellite.js'
import {
  getTLE, getTLEBulk, getSATCAT, getSATCATBulk, searchByName,
  positionCacheGet, positionCacheSet, sessionStatus,
} from '../lib/spaceTrackClient.js'
import { rateLimiter, PRIORITY } from '../lib/spaceTrackRateLimiter.js'
import { logger } from '../lib/logger.js'

const router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Validate a TLE with satellite.js; returns { valid, satrec, error? } */
function validateTLE(line1, line2) {
  try {
    const satrec = satellite.twoline2satrec(line1, line2)
    const valid  = satrec.error === 0
    return { valid, satrec, error: valid ? null : `satrec error code ${satrec.error}` }
  } catch (e) {
    return { valid: false, satrec: null, error: e.message }
  }
}

/** Hours since a TLE epoch string (e.g. "2024-01-15 06:30:00"). */
function tleAgeHours(epochStr) {
  const epoch = new Date(epochStr)
  if (isNaN(epoch.getTime())) return null
  return (Date.now() - epoch.getTime()) / 3_600_000
}

/** Propagate a satrec to a given date; returns { lat, lng, alt_km, vx, vy, vz } or null. */
function propagateAt(satrec, date) {
  const pv   = satellite.propagate(satrec, date)
  if (!pv?.position || isNaN(pv.position.x)) return null
  const gmst = satellite.gstime(date)
  const gd   = satellite.eciToGeodetic(pv.position, gmst)
  const vel  = pv.velocity
  return {
    lat_deg:     satellite.degreesLat(gd.latitude),
    lng_deg:     satellite.degreesLong(gd.longitude),
    alt_km:      gd.height,                          // satellite.js returns km
    velocity_kms: Math.sqrt(vel.x**2 + vel.y**2 + vel.z**2),
  }
}

/** Trigram Jaccard similarity for fuzzy name matching (0–1). */
function similarity(a, b) {
  const clean  = s => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const grams  = s => new Set(Array.from({ length: Math.max(0, s.length - 2) }, (_, i) => s.slice(i, i + 3)))
  const s1 = grams(clean(a)), s2 = grams(clean(b))
  if (!s1.size || !s2.size) return 0
  const intersection = [...s1].filter(g => s2.has(g)).length
  const union = new Set([...s1, ...s2]).size
  return intersection / union
}

function rateLimitError(res, err) {
  return res.status(429).json({ error: 'rate_limit', message: err.message })
}

// ─── GET /api/tle/status ──────────────────────────────────────────────────

router.get('/status', (_req, res) => {
  res.json({
    ...sessionStatus(),
    ...rateLimiter.status(),
    ts: new Date().toISOString(),
  })
})

// ─── GET /api/tle/satcat/:noradId ─────────────────────────────────────────

router.get('/satcat/:noradId', async (req, res) => {
  const id = parseInt(req.params.noradId, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid NORAD ID' })

  try {
    const entry = await getSATCAT(id)
    if (!entry) return res.status(404).json({ error: `NORAD ${id} not found in SATCAT` })

    // Augment with derived fields
    const launchDate = entry.launch_date ? new Date(entry.launch_date) : null
    const decayDate  = entry.decay_date  ? new Date(entry.decay_date)  : null
    const now        = new Date()

    res.json({
      ...entry,
      age_on_orbit_days: launchDate ? Math.floor((now - launchDate) / 86_400_000) : null,
      is_decayed:        !!decayDate && decayDate < now,
      days_since_decay:  decayDate && decayDate < now
        ? Math.floor((now - decayDate) / 86_400_000) : null,
      _meta: { source: 'Space-Track SATCAT', ts: new Date().toISOString() },
    })
  } catch (err) {
    if (err.isRateLimit) return rateLimitError(res, err)
    logger.error('[TLE] satcat error', { id, err: err.message })
    res.status(503).json({ error: 'TLE data temporarily unavailable', detail: err.message })
  }
})

// ─── GET /api/tle/lookup/:launchId ────────────────────────────────────────
// Bridges an LL2 launch ID → Space-Track NORAD catalog entries.

router.get('/lookup/:launchId', async (req, res) => {
  const launchId = req.params.launchId

  try {
    // 1. Fetch the LL2 launch to get NET date, payload name, launch site country
    const { data: ll2 } = await import('axios').then(m =>
      m.default.get(`https://ll.thespacedevs.com/2.2.0/launch/${launchId}/`, { timeout: 10_000 })
    ).catch(() => ({ data: null }))

    if (!ll2) return res.status(404).json({ error: 'LL2 launch not found', launchId })

    const netDate     = ll2.net ? new Date(ll2.net) : null
    const payloadName = ll2.mission?.name || ll2.name?.split('|')[1]?.trim() || ''
    const country     = ll2.pad?.location?.country_code || ''

    if (!netDate) return res.status(422).json({ error: 'Launch has no NET date — cannot resolve NORAD ID' })

    // 2. Search Space-Track by payload name
    let candidates = []
    if (payloadName.length >= 3) {
      const results = await searchByName(payloadName.split(' ')[0]) // first word often most unique
      candidates = results
    }

    // 3. Also fetch recent bulk SATCAT and look within ±3 days of NET
    const bulk      = await getSATCATBulk()
    const netMs     = netDate.getTime()
    const threeDays = 3 * 86_400_000

    const nearby = bulk.filter(s => {
      if (!s.launch_date) return false
      const ld = new Date(s.launch_date).getTime()
      return Math.abs(ld - netMs) <= threeDays
    })

    // Merge candidates (deduplicate by NORAD ID)
    const all = new Map()
    ;[...candidates, ...nearby].forEach(s => all.set(s.norad_id, s))

    // 4. Score by name similarity
    const scored = [...all.values()]
      .map(s => ({
        norad_id:         s.norad_id,
        object_name:      s.object_name,
        country:          s.country,
        launch_date:      s.launch_date,
        similarity_score: similarity(payloadName, s.object_name),
      }))
      .filter(s => s.similarity_score > 0.05 || nearby.some(n => n.norad_id === s.norad_id))
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, 10)

    res.json({
      launchId,
      payloadName,
      netDate: netDate.toISOString(),
      country,
      matches: scored,
      _meta: { source: 'Space-Track SATCAT + LL2', ts: new Date().toISOString() },
    })
  } catch (err) {
    if (err.isRateLimit) return rateLimitError(res, err)
    logger.error('[TLE] lookup error', { launchId, err: err.message })
    res.status(503).json({ error: 'Lookup failed', detail: err.message })
  }
})

// ─── GET /api/tle/:noradId ────────────────────────────────────────────────

router.get('/:noradId', async (req, res) => {
  const id = parseInt(req.params.noradId, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid NORAD ID' })

  try {
    const tle       = await getTLE(id)
    const { valid, satrec, error: tleError } = validateTLE(tle.line1, tle.line2)
    const ageHours  = tleAgeHours(tle.epoch)
    const stale     = ageHours != null && ageHours > 7 * 24

    res.json({
      ...tle,
      valid,
      age_hours: ageHours != null ? parseFloat(ageHours.toFixed(2)) : null,
      stale,
      warning: stale ? 'TLE is older than 7 days — propagation accuracy may be degraded' : null,
      error:   tleError,
      _meta:   { source: 'Space-Track TLE_LATEST', ts: new Date().toISOString() },
    })
  } catch (err) {
    if (err.isRateLimit) return rateLimitError(res, err)
    logger.error('[TLE] fetch error', { id, err: err.message })
    res.status(503).json({ error: 'TLE data temporarily unavailable', detail: err.message })
  }
})

// ─── GET /api/tle/:noradId/position ──────────────────────────────────────

router.get('/:noradId/position', async (req, res) => {
  const id = parseInt(req.params.noradId, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid NORAD ID' })

  // 30-second in-memory cache for positions
  const cached = positionCacheGet(id)
  if (cached) return res.set('X-Cache', 'HIT').json(cached)

  try {
    const tle    = await getTLE(id)
    const { valid, satrec } = validateTLE(tle.line1, tle.line2)
    if (!valid) return res.status(422).json({ error: 'Invalid TLE — cannot propagate' })

    const now    = new Date()
    const pos    = propagateAt(satrec, now)
    if (!pos)    return res.status(422).json({ error: 'Propagation failed — satellite may have decayed' })

    const result = {
      norad_id:    id,
      object_name: tle.object_name,
      ...pos,
      timestamp:   now.toISOString(),
      tle_epoch:   tle.epoch,
      tle_age_hours: parseFloat((tleAgeHours(tle.epoch) ?? 0).toFixed(2)),
      _meta: { source: 'Space-Track TLE + satellite.js', cache_ttl_s: 30 },
    }

    positionCacheSet(id, result)
    res.set('X-Cache', 'MISS').json(result)
  } catch (err) {
    if (err.isRateLimit) return rateLimitError(res, err)
    logger.error('[TLE] position error', { id, err: err.message })
    res.status(503).json({ error: 'TLE data temporarily unavailable', detail: err.message })
  }
})

// ─── GET /api/tle/:noradId/ground-track ──────────────────────────────────

router.get('/:noradId/ground-track', async (req, res) => {
  const id           = parseInt(req.params.noradId, 10)
  if (isNaN(id))     return res.status(400).json({ error: 'Invalid NORAD ID' })

  const hours        = Math.min(12, parseFloat(req.query.hours)        || 3)
  const stepSeconds  = Math.max(10, parseInt(req.query.step_seconds, 10) || 60)
  const maxPoints    = 1440
  const totalSteps   = Math.floor((hours * 3600) / stepSeconds)
  const numPoints    = Math.min(totalSteps, maxPoints)

  try {
    const tle    = await getTLE(id)
    const { valid, satrec } = validateTLE(tle.line1, tle.line2)
    if (!valid) return res.status(422).json({ error: 'Invalid TLE — cannot propagate' })

    const track  = []
    const now    = Date.now()

    for (let i = 0; i < numPoints; i++) {
      const t   = new Date(now + i * stepSeconds * 1000)
      const pos = propagateAt(satrec, t)
      if (pos) {
        track.push({
          lat:       parseFloat(pos.lat_deg.toFixed(5)),
          lng:       parseFloat(pos.lng_deg.toFixed(5)),
          alt_km:    parseFloat(pos.alt_km.toFixed(2)),
          timestamp: t.toISOString(),
        })
      }
    }

    res.json({
      norad_id:    id,
      object_name: tle.object_name,
      hours,
      step_seconds: stepSeconds,
      point_count:  track.length,
      track,
      tle_epoch: tle.epoch,
      _meta: { source: 'Space-Track TLE + satellite.js propagation' },
    })
  } catch (err) {
    if (err.isRateLimit) return rateLimitError(res, err)
    logger.error('[TLE] ground-track error', { id, err: err.message })
    res.status(503).json({ error: 'TLE data temporarily unavailable', detail: err.message })
  }
})

export { router as tleRouter }
