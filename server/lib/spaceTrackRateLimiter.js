/**
 * Space-Track rate limiter.
 *
 * Enforces two sliding-window constraints:
 *   - 28 req/min  (Space-Track limit: 30, buffer: 2)
 *   - 290 req/hr  (Space-Track limit: 300, buffer: 10)
 *
 * Priority levels (higher = served first):
 *   3 — position updates   (time-sensitive)
 *   2 — single TLE, ground tracks
 *   1 — SATCAT lookups
 *   0 — bulk fetches, background tasks
 */

import { logger } from './logger.js'

export const PRIORITY = {
  POSITION:   3,
  TLE:        2,
  SATCAT:     1,
  BULK:       0,
}

class SpaceTrackRateLimiter {
  constructor() {
    this._minTs  = []   // timestamps of requests in the last 60 s
    this._hrTs   = []   // timestamps of requests in the last 3600 s
    this._queue  = []   // { fn, priority, resolve, reject, enqueuedAt }
    this._active = false

    this.MAX_PER_MIN  = 28
    this.MAX_PER_HOUR = 290
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  _evict() {
    const now = Date.now()
    this._minTs = this._minTs.filter(t => now - t < 60_000)
    this._hrTs  = this._hrTs.filter(t => now - t < 3_600_000)
  }

  _canFire() {
    this._evict()
    return this._minTs.length < this.MAX_PER_MIN && this._hrTs.length < this.MAX_PER_HOUR
  }

  /** Returns ms to wait before the next slot opens. */
  _waitMs() {
    this._evict()
    let wait = 0
    if (this._minTs.length >= this.MAX_PER_MIN && this._minTs.length > 0)
      wait = Math.max(wait, 60_000 - (Date.now() - this._minTs[0]) + 50)
    if (this._hrTs.length >= this.MAX_PER_HOUR && this._hrTs.length > 0)
      wait = Math.max(wait, 3_600_000 - (Date.now() - this._hrTs[0]) + 50)
    return wait
  }

  _record(endpoint) {
    const t = Date.now()
    this._minTs.push(t)
    this._hrTs.push(t)
    logger.info('[SpaceTrack] request fired', { endpoint, req_min: this._minTs.length, req_hr: this._hrTs.length })
  }

  async _process() {
    if (this._active) return
    this._active = true

    while (this._queue.length > 0) {
      if (!this._canFire()) {
        const wait = this._waitMs()
        logger.warn(`[SpaceTrack] rate limit — waiting ${(wait / 1000).toFixed(1)}s`, {
          queue: this._queue.length, req_min: this._minTs.length,
        })
        await new Promise(r => setTimeout(r, wait))
        continue
      }

      // Highest priority first (sort is stable in V8)
      this._queue.sort((a, b) => b.priority - a.priority)
      const { fn, resolve, reject, endpoint } = this._queue.shift()

      const t0 = Date.now()
      this._record(endpoint)
      try {
        const result = await fn()
        logger.info('[SpaceTrack] request ok', { endpoint, ms: Date.now() - t0 })
        resolve(result)
      } catch (err) {
        logger.error('[SpaceTrack] request failed', { endpoint, ms: Date.now() - t0, err: err.message })
        reject(err)
      }
    }

    this._active = false
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Enqueue a Space-Track HTTP call.
   * @param {Function} fn         async () => <result>
   * @param {number}   priority   PRIORITY constant (default: TLE)
   * @param {string}   endpoint   label for logging
   */
  execute(fn, priority = PRIORITY.TLE, endpoint = 'unknown') {
    return new Promise((resolve, reject) => {
      this._queue.push({ fn, priority, endpoint, resolve, reject, enqueuedAt: Date.now() })
      this._process()
    })
  }

  status() {
    this._evict()
    return {
      requests_last_minute: this._minTs.length,
      requests_last_hour:   this._hrTs.length,
      queue_depth:          this._queue.length,
      max_per_minute:       this.MAX_PER_MIN,
      max_per_hour:         this.MAX_PER_HOUR,
      can_fire_now:         this._canFire(),
    }
  }
}

export const rateLimiter = new SpaceTrackRateLimiter()
