/**
 * Persistent disk cache + sliding-window rate budget tracker.
 *
 * Cache files live in server/cache-data/ as {key}.json.
 * They survive server restarts — critical for staying within the LL2 rate limit
 * (set LL2_RATE_LIMIT in .env: 15 anonymous, 45 basic key, 300 premium).
 *
 * TTL tiers:
 *   UPCOMING_FRESH   5 min   — serve without background refresh
 *   UPCOMING_STALE  30 min   — serve stale, trigger background refresh
 *   HISTORY         24 hr    — past launches never change
 *   STATS           24 hr    — aggregate stats
 *   DETAIL           7 days  — individual past launch records
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(__dirname, 'cache-data')

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })

// ─── TTL constants (ms) ────────────────────────────────────────────────────
export const TTL = {
  UPCOMING_FRESH:  5  * 60_000,
  UPCOMING_STALE:  30 * 60_000,
  HISTORY:         24 * 60 * 60_000,
  STATS:           24 * 60 * 60_000,
  DETAIL:          7  * 24 * 60 * 60_000,
}

// ─── Disk cache ────────────────────────────────────────────────────────────

function cacheFile(key) {
  const safe = key.replace(/[^a-z0-9]/gi, '_').slice(0, 180)
  return path.join(CACHE_DIR, `${safe}.json`)
}

/**
 * Read a cache entry.
 * Returns { data, ts, age, fresh, stale } or null if the file doesn't exist.
 * `fresh`  = age < freshTtl
 * `stale`  = freshTtl <= age < staleTtl (serve but refresh in background)
 * absent   = age >= staleTtl OR file missing
 */
export function cacheRead(key, freshTtl, staleTtl = freshTtl) {
  try {
    const raw = fs.readFileSync(cacheFile(key), 'utf8')
    const { data, ts } = JSON.parse(raw)
    const age = Date.now() - ts
    if (age < freshTtl)  return { data, ts, age, fresh: true,  stale: false }
    if (age < staleTtl)  return { data, ts, age, fresh: false, stale: true  }
    return null  // too old — treat as miss
  } catch {
    return null
  }
}

export function cacheWrite(key, data) {
  try {
    fs.writeFileSync(cacheFile(key), JSON.stringify({ data, ts: Date.now() }))
  } catch (e) {
    console.warn('[Cache] Write failed:', e.message)
  }
}

/** How many cache files exist and total size. */
export function cacheStats() {
  try {
    const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'))
    const totalBytes = files.reduce((sum, f) => {
      try { return sum + fs.statSync(path.join(CACHE_DIR, f)).size } catch { return sum }
    }, 0)
    return { entries: files.length, totalKb: Math.round(totalBytes / 1024) }
  } catch {
    return { entries: 0, totalKb: 0 }
  }
}

// ─── Rate budget tracker ───────────────────────────────────────────────────
// Sliding 1-hour window. LL2_RATE_LIMIT env var sets the tier (default 15 anonymous).
// We leave 1 request as a safety buffer, so effective cap = LL2_RATE_LIMIT - 1.

const RATE_WINDOW_MS = 60 * 60_000

const _requestLog = []

function _evict() {
  const cutoff = Date.now() - RATE_WINDOW_MS
  while (_requestLog.length && _requestLog[0] < cutoff) _requestLog.shift()
}

// Read lazily so dotenv has a chance to populate process.env before first call.
function _maxRequests() {
  return Math.max(1, parseInt(process.env.LL2_RATE_LIMIT || '15') - 1)
}

export function getBudgetStatus() {
  _evict()
  const max       = _maxRequests()
  const used      = _requestLog.length
  const remaining = Math.max(0, max - used)
  const resetAt   = _requestLog.length > 0
    ? new Date(_requestLog[0] + RATE_WINDOW_MS).toISOString()
    : null
  return { used, remaining, max, resetAt, canFetch: remaining > 0 }
}

export function recordRequest() {
  _evict()
  _requestLog.push(Date.now())
}

// ─── Convenience wrapper ───────────────────────────────────────────────────

/**
 * Fetch-with-cache helper.
 *
 * Strategy:
 *   1. Fresh cache hit  → return immediately, no API call
 *   2. Stale cache hit  → return stale immediately; if budget allows, refresh
 *      in background (stale-while-revalidate)
 *   3. Cache miss + budget → fetch, cache, return
 *   4. Cache miss + no budget → throw rate-limit error
 *
 * @param {string}   key
 * @param {Function} fetchFn   async () => data
 * @param {object}   ttls      { fresh, stale? }  (ms)
 * @param {object}   [opts]
 * @param {boolean}  [opts.backgroundRefresh=true]  SWR on stale
 * @returns {{ data, fromCache, stale, budget }}
 */
export async function fetchWithCache(key, fetchFn, { fresh, stale }, opts = {}) {
  const { backgroundRefresh = true } = opts

  const hit = cacheRead(key, fresh, stale ?? fresh)

  if (hit?.fresh) {
    return { data: hit.data, fromCache: true, stale: false, budget: getBudgetStatus() }
  }

  const budget = getBudgetStatus()

  if (hit?.stale) {
    // Serve stale immediately
    if (backgroundRefresh && budget.canFetch) {
      // Fire-and-forget background refresh
      setImmediate(async () => {
        try {
          recordRequest()
          const fresh = await fetchFn()
          cacheWrite(key, fresh)
        } catch (e) {
          console.warn(`[Cache] Background refresh failed for "${key}":`, e.message)
        }
      })
    }
    return { data: hit.data, fromCache: true, stale: true, budget: getBudgetStatus() }
  }

  // Cache miss
  if (!budget.canFetch) {
    const err = new Error(
      `LL2 rate limit: ${budget.used}/${budget.max} requests used this hour. ` +
      `Resets at ${budget.resetAt ?? 'unknown'}.`
    )
    err.isRateLimit = true
    err.budget = budget
    throw err
  }

  recordRequest()
  const data = await fetchFn()
  cacheWrite(key, data)
  return { data, fromCache: false, stale: false, budget: getBudgetStatus() }
}
