import { Router } from 'express'
import { fetchWithCache, TTL } from '../cacheManager.js'
import { ll2, LL2_BASE } from '../lib/ll2Client.js'

const router  = Router()

/**
 * GET /api/launches/vehicle-config?name={query}
 * Searches LL2 /config/launcher/ and normalises results into formula-ready values.
 */
function normalise(v) {
  return {
    id:           v.id,
    name:         v.full_name || v.name,
    family:       v.family,
    manufacturer: v.manufacturer?.name,
    thrust_N:     v.to_thrust   != null ? v.to_thrust   * 1000 : null,  // kN → N
    totalMass_kg: v.launch_mass != null ? v.launch_mass * 1000 : null,  // t  → kg
    payloadLEO_kg: v.leo_capacity,
    payloadGTO_kg: v.gto_capacity,
    stages:        v.max_stage,
    diameter_m:    v.diameter,
    length_m:      v.length,
    isp_vac_s:     null,
    isp_sl_s:      null,
    launchCount:   v.total_launch_count,
    successRate:   v.total_launch_count > 0
      ? Math.round((v.successful_launches / v.total_launch_count) * 100)
      : null,
    imageUrl: v.image_url,
  }
}

router.get('/vehicle-config', async (req, res) => {
  const name = (req.query.name || '').trim()
  if (!name) return res.status(400).json({ error: 'name param required' })

  const searchKey = `vehicle_config_${name.toLowerCase().replace(/\s+/g, '_')}`

  try {
    // Step 1: search for matching configs (returns minimal fields — just IDs + URLs)
    const { data: searchData, fromCache: searchFromCache } = await fetchWithCache(
      searchKey,
      async () => {
        const params = new URLSearchParams({ search: name, ordering: '-launch_count', limit: '8' })
        const { data } = await ll2.getUrl(`${LL2_BASE}/config/launcher/?${params}`)
        return data
      },
      { fresh: TTL.HISTORY, stale: TTL.HISTORY * 2 },
    )

    // Step 2: fetch full detail for each result.
    // LL2's list endpoint returns minimal fields; the individual /config/launcher/{id}/
    // endpoint returns the complete set (leo_capacity, to_thrust, max_stage, etc.).
    // Each detail is cached per-ID so repeat searches are free.
    const fullConfigs = await Promise.all(
      (searchData.results || []).map(async (v) => {
        if (!v.url) return v
        const detailKey = `config_${v.id}`
        const hit = (await import('../cacheManager.js')).cacheRead(detailKey, TTL.HISTORY)
        if (hit?.data) return hit.data

        try {
          const { data: full } = await ll2.getUrl(v.url)
          ;(await import('../cacheManager.js')).cacheWrite(detailKey, full)
          return full
        } catch {
          return v  // fall back to minimal on network error
        }
      })
    )

    const results = fullConfigs.map(normalise)
    res.json({ results, _meta: { query: name, count: results.length, fromCache: searchFromCache } })
  } catch (err) {
    if (err.isRateLimit) return res.status(429).json({ error: 'rate_limit', message: err.message })
    console.error('[VehicleConfig]', err.response?.status, err.message)
    res.status(502).json({ error: 'fetch_failed', message: err.message })
  }
})

export { router as vehiclesRouter }
