/**
 * Space-Track.org API client.
 *
 * Authentication: session cookie (POST /ajaxauth/login).
 * Session cached for 2 hours before re-login.
 *
 * All public methods go through the rate limiter and disk cache where appropriate.
 * Native fetch (Node 18+) is used — no node-fetch required.
 */

import { cacheRead, cacheWrite } from '../cacheManager.js'
import { rateLimiter, PRIORITY } from './spaceTrackRateLimiter.js'
import { logger } from './logger.js'

const BASE      = 'https://www.space-track.org'
const LOGIN_URL = `${BASE}/ajaxauth/login`

// TTLs (ms)
const TTL_TLE    = 3_600_000      // 1 hr  — TLEs update once/twice a day
const TTL_SATCAT = 86_400_000     // 24 hr — orbital parameters stable
const TTL_BULK   = 3_600_000      // 1 hr
const TTL_NAME   = 86_400_000     // 24 hr
const SESSION_TTL = 7_200_000     // 2 hr  — session cookie lifetime

// In-memory position cache (30 s — changes constantly, not worth disk writes)
const _posCache = new Map()
const POS_TTL   = 30_000

// Session state
let _sessionCookie = null
let _sessionExpiry = 0

// ─── Auth ─────────────────────────────────────────────────────────────────

async function login() {
  const username = process.env.SPACETRACK_USERNAME
  const password = process.env.SPACETRACK_PASSWORD
  if (!username || !password) throw new Error('SPACETRACK_USERNAME / SPACETRACK_PASSWORD not set in .env')

  logger.info('[SpaceTrack] logging in…')
  const body = new URLSearchParams({ identity: username, password })
  const res  = await fetch(LOGIN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
    redirect: 'follow',
  })

  if (!res.ok) throw new Error(`Space-Track login failed: HTTP ${res.status}`)

  // Parse the session cookie (format: "chocolatechip=<token>; Path=/; ...")
  const raw = res.headers.get('set-cookie')
  if (!raw) throw new Error('Space-Track login: no set-cookie header in response')

  _sessionCookie = raw.split(';')[0].trim()  // "chocolatechip=<value>"
  _sessionExpiry = Date.now() + SESSION_TTL
  logger.info('[SpaceTrack] login OK, session valid until', { expires: new Date(_sessionExpiry).toISOString() })
}

async function ensureSession() {
  if (!_sessionCookie || Date.now() > _sessionExpiry) await login()
}

// ─── Core fetcher ─────────────────────────────────────────────────────────

async function stFetch(endpoint) {
  await ensureSession()
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { Cookie: _sessionCookie },
  })

  // Session expired → re-login once
  if (res.status === 401) {
    _sessionCookie = null
    await ensureSession()
    const retry = await fetch(`${BASE}${endpoint}`, {
      headers: { Cookie: _sessionCookie },
    })
    if (!retry.ok) throw new Error(`Space-Track HTTP ${retry.status} on retry: ${endpoint}`)
    return retry.json()
  }

  if (!res.ok) throw new Error(`Space-Track HTTP ${res.status}: ${endpoint}`)
  return res.json()
}

// ─── TLE helpers ──────────────────────────────────────────────────────────

function normalizeTLE(raw) {
  return {
    norad_id:    parseInt(raw.NORAD_CAT_ID, 10),
    object_name: raw.OBJECT_NAME,
    epoch:       raw.EPOCH,
    line1:       raw.TLE_LINE1,
    line2:       raw.TLE_LINE2,
  }
}

function normalizeSATCAT(raw) {
  return {
    norad_id:          parseInt(raw.NORAD_CAT_ID, 10),
    object_name:       raw.OBJECT_NAME,
    country:           raw.COUNTRY,
    launch_date:       raw.LAUNCH,
    decay_date:        raw.DECAY || null,
    period_min:        raw.PERIOD ? parseFloat(raw.PERIOD) : null,
    inclination_deg:   raw.INCLINATION ? parseFloat(raw.INCLINATION) : null,
    apogee_km:         raw.APOGEE ? parseInt(raw.APOGEE, 10) : null,
    perigee_km:        raw.PERIGEE ? parseInt(raw.PERIGEE, 10) : null,
    object_type:       raw.OBJECT_TYPE,
    operational_status:raw.OPSTATUS,
    rcs_size:          raw.RCS_SIZE,
  }
}

// ─── Public methods ───────────────────────────────────────────────────────

/**
 * Fetch the latest TLE for a single NORAD ID.
 * Cached 1 hour on disk.
 * @param {number|string} noradId
 */
export async function getTLE(noradId) {
  const key = `tle_${noradId}`
  const hit = cacheRead(key, TTL_TLE)
  if (hit?.fresh || hit?.stale) return hit.data

  const endpoint = `/basicspacedata/query/class/tle_latest/NORAD_CAT_ID/${noradId}/orderby/EPOCH%20desc/limit/1/format/json`
  const data = await rateLimiter.execute(
    () => stFetch(endpoint),
    PRIORITY.TLE,
    `tle/${noradId}`
  )

  if (!data?.length) throw new Error(`No TLE found for NORAD ID ${noradId}`)
  const tle = normalizeTLE(data[0])
  cacheWrite(key, tle)
  return tle
}

/**
 * Batch-fetch TLEs for up to N NORAD IDs (auto-chunks at 50).
 * Each TLE cached individually for 1 hour.
 * @param {number[]} noradIds
 */
export async function getTLEBulk(noradIds) {
  const results  = []
  const CHUNK    = 50

  for (let i = 0; i < noradIds.length; i += CHUNK) {
    const chunk = noradIds.slice(i, i + CHUNK)

    // Serve from cache where possible, only fetch misses
    const misses = []
    for (const id of chunk) {
      const hit = cacheRead(`tle_${id}`, TTL_TLE)
      if (hit?.fresh || hit?.stale) results.push(hit.data)
      else misses.push(id)
    }

    if (misses.length === 0) continue

    const ids      = misses.join(',')
    const endpoint = `/basicspacedata/query/class/tle_latest/NORAD_CAT_ID/${ids}/orderby/EPOCH%20desc/limit/${misses.length * 2}/format/json`
    const data     = await rateLimiter.execute(
      () => stFetch(endpoint),
      PRIORITY.BULK,
      `tle_bulk(${misses.length})`
    )

    const seen = new Set()
    for (const raw of (data || [])) {
      const id = parseInt(raw.NORAD_CAT_ID, 10)
      if (!seen.has(id)) {
        seen.add(id)
        const tle = normalizeTLE(raw)
        cacheWrite(`tle_${id}`, tle)
        results.push(tle)
      }
    }
  }

  return results
}

/**
 * Fetch the SATCAT entry for a single NORAD ID.
 * Cached 24 hours on disk.
 * @param {number|string} noradId
 */
export async function getSATCAT(noradId) {
  const key = `satcat_${noradId}`
  const hit = cacheRead(key, TTL_SATCAT)
  if (hit?.fresh || hit?.stale) return hit.data

  const endpoint = `/basicspacedata/query/class/satcat/NORAD_CAT_ID/${noradId}/format/json`
  const data     = await rateLimiter.execute(
    () => stFetch(endpoint),
    PRIORITY.SATCAT,
    `satcat/${noradId}`
  )

  if (!data?.length) return null
  const entry = normalizeSATCAT(data[0])
  cacheWrite(key, entry)
  return entry
}

/**
 * Fetch the 500 most recently-launched active satellites.
 * Used for cross-referencing LL2 payloads with SATCAT entries.
 * Cached 1 hour on disk.
 */
export async function getSATCATBulk() {
  const key = 'satcat_bulk_recent'
  const hit = cacheRead(key, TTL_BULK)
  if (hit?.fresh || hit?.stale) return hit.data

  const endpoint = '/basicspacedata/query/class/satcat/CURRENT/Y/orderby/LAUNCH%20desc/limit/500/format/json'
  const data     = await rateLimiter.execute(
    () => stFetch(endpoint),
    PRIORITY.BULK,
    'satcat_bulk'
  )

  const entries = (data || []).map(normalizeSATCAT)
  cacheWrite(key, entries)
  return entries
}

/**
 * Search SATCAT by satellite name (partial match).
 * Cached 24 hours on disk.
 * @param {string} name
 */
export async function searchByName(name) {
  const safeName = encodeURIComponent(name.toUpperCase())
  const key      = `satcat_name_${name.toLowerCase().replace(/\s+/g, '_')}`
  const hit      = cacheRead(key, TTL_NAME)
  if (hit?.fresh || hit?.stale) return hit.data

  const endpoint = `/basicspacedata/query/class/satcat/OBJECT_NAME/${safeName}/format/json`
  const data     = await rateLimiter.execute(
    () => stFetch(endpoint),
    PRIORITY.SATCAT,
    `satcat/name/${name}`
  )

  const entries = (data || []).map(normalizeSATCAT)
  cacheWrite(key, entries)
  return entries
}

// ─── Position cache helpers (in-memory, 30 s) ─────────────────────────────

export function positionCacheGet(noradId) {
  const entry = _posCache.get(String(noradId))
  if (!entry) return null
  if (Date.now() - entry.ts > POS_TTL) { _posCache.delete(String(noradId)); return null }
  return entry.data
}

export function positionCacheSet(noradId, data) {
  _posCache.set(String(noradId), { data, ts: Date.now() })
}

// ─── Failed launches ──────────────────────────────────────────────────────
// Returns SATCAT payload entries where DECAY occurred within RAPID_DECAY_DAYS
// of LAUNCH — a reliable proxy for launch failures (failed orbit insertion).
// Objects that never reached space won't appear in SATCAT, but payloads that
// barely made it and then immediately decayed are captured here.

const RAPID_DECAY_DAYS = 7    // decay within a week of launch = probable failure
const TTL_FAILURES     = 24 * 3_600_000  // 24 hr — historical data doesn't change

/**
 * All decayed PAYLOAD objects where DECAY − LAUNCH ≤ 7 days.
 * Fetches in a single bulk query and filters client-side.
 * Cached 24 hr.
 */
export async function getFailedLaunches() {
  const key = 'satcat_failed_launches'
  const hit = cacheRead(key, TTL_FAILURES)
  if (hit?.fresh || hit?.stale) return hit.data

  // Two targeted queries — no offset/pagination (SpaceTrack doesn't support
  // offset as a path segment; single bulk fetches only).
  //
  // Query A: payloads with perigee ≤ 200 km — never reached stable orbit,
  //          almost all decay within days of launch.
  // Query B: payloads with a DECAY date set — filter client-side for
  //          DECAY − LAUNCH ≤ RAPID_DECAY_DAYS.
  //
  // SpaceTrack range syntax: FIELD/low--high (double-dash, no spaces).

  const [pageA, pageB] = await Promise.all([
    rateLimiter.execute(
      () => stFetch(
        '/basicspacedata/query/class/satcat' +
        '/OBJECT_TYPE/PAYLOAD' +
        '/PERIGEE/1--200' +
        '/orderby/LAUNCH%20desc' +
        '/limit/1000' +
        '/format/json'
      ),
      PRIORITY.BULK,
      'satcat_low_perigee'
    ),
    rateLimiter.execute(
      () => stFetch(
        '/basicspacedata/query/class/satcat' +
        '/OBJECT_TYPE/PAYLOAD' +
        '/DECAY/1957-10-04--now' +
        '/orderby/LAUNCH%20desc' +
        '/limit/1000' +
        '/format/json'
      ),
      PRIORITY.BULK,
      'satcat_rapid_decay'
    ),
  ])

  // Merge, de-duplicate, then filter
  const seen = new Set()
  const merged = []
  for (const obj of [...(pageA || []), ...(pageB || [])]) {
    const id = obj.NORAD_CAT_ID || obj.INTERNATIONAL_DESIGNATOR
    if (id && !seen.has(id)) { seen.add(id); merged.push(obj) }
  }

  const failures = merged.filter(obj => {
    if (!obj.LAUNCH) return false
    const perigee = obj.PERIGEE ? parseInt(obj.PERIGEE, 10) : null
    if (perigee !== null && perigee <= 200) return true
    if (!obj.DECAY) return false
    const days = (new Date(obj.DECAY) - new Date(obj.LAUNCH)) / 86_400_000
    return days >= 0 && days <= RAPID_DECAY_DAYS
  })

  cacheWrite(key, failures)
  logger.info('[SpaceTrack] failed-launches cached', { merged: merged.length, failures: failures.length })
  return failures
}

// ─── Session status ────────────────────────────────────────────────────────

export function sessionStatus() {
  return {
    session_active: !!_sessionCookie && Date.now() < _sessionExpiry,
    session_expires: _sessionExpiry ? new Date(_sessionExpiry).toISOString() : null,
  }
}
