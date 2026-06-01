import { Router } from 'express'
import { fetchWithCache, TTL, getBudgetStatus } from '../cacheManager.js'
import { ll2, LL2_BASE } from '../lib/ll2Client.js'
import { getTLE } from '../lib/spaceTrackClient.js'

const router = Router()

// Typical orbital parameters by LL2 orbit abbreviation
const ORBIT_DEFAULTS = {
  LEO:   { apogee: 400,    perigee: 400,   inclination: 51.6 },
  VLEO:  { apogee: 340,    perigee: 330,   inclination: 53   },
  SSO:   { apogee: 550,    perigee: 540,   inclination: 97.7 },
  ISS:   { apogee: 420,    perigee: 408,   inclination: 51.6 },
  MEO:   { apogee: 20200,  perigee: 20100, inclination: 55   },
  GTO:   { apogee: 35786,  perigee: 200,   inclination: 27   },
  GEO:   { apogee: 35786,  perigee: 35786, inclination: 0.1  },
  HEO:   { apogee: 39000,  perigee: 500,   inclination: 63.4 },
  POLAR: { apogee: 600,    perigee: 590,   inclination: 90   },
  TLI:   { apogee: 380000, perigee: 200,   inclination: 28   },
}

router.get('/:launchId', async (req, res) => {
  const { launchId } = req.params
  const cacheKey = `orbit_${launchId}`

  try {
    const { data, fromCache, budget } = await fetchWithCache(
      cacheKey,
      async () => {
        // 1. Fetch full launch record from LL2
        const { data: launch } = await ll2.getUrl(
          `${LL2_BASE}/launch/${launchId}/?mode=detailed`
        )

        const orbitAbbrev = launch.mission?.orbit?.abbrev || 'LEO'
        const def = ORBIT_DEFAULTS[orbitAbbrev] || ORBIT_DEFAULTS.LEO

        // 2. Extract / default orbital elements
        const orbitElements = {
          apogee_km:       launch.mission?.orbit?.apogee   ?? def.apogee,
          perigee_km:      launch.mission?.orbit?.perigee  ?? def.perigee,
          inclination_deg: launch.mission?.orbit?.inclination ?? def.inclination,
          raan_deg:        launch.mission?.orbit?.raan         ?? 0,
          arg_perigee_deg: launch.mission?.orbit?.arg_of_perigee ?? 0,
          mean_anomaly_deg: 0,
        }

        // 3. Try to get TLE from Space-Track (best-effort)
        let tle = null
        try {
          // The LL2 launch record may contain a linked Space-Track NORAD ID
          const noradId = launch.rocket?.spacecraft_stage?.landing?.attempt != null
            ? null
            : extractNoradId(launch)

          if (noradId) {
            const tleData = await getTLE(noradId)
            if (tleData?.line1) tle = { line1: tleData.line1, line2: tleData.line2 }
          }
        } catch { /* TLE is optional */ }

        // 4. Launch site
        const launchSite = {
          lat:  launch.pad?.latitude  ? parseFloat(launch.pad.latitude)  : null,
          lng:  launch.pad?.longitude ? parseFloat(launch.pad.longitude) : null,
          name: launch.pad?.name || launch.pad?.location?.name || 'Launch Site',
        }

        return {
          launchId,
          launchName:   launch.name,
          orbitAbbrev,
          orbitElements,
          tle,
          launchSite,
          status:       launch.status?.abbrev,
          net:          launch.net,
        }
      },
      { fresh: TTL.DETAIL, stale: TTL.DETAIL * 2 },
    )

    return res.json({
      ...data,
      _meta: { fetchedAt: new Date().toISOString(), source: 'LL2 v2.2.0 + Space-Track', fromCache, budget },
    })
  } catch (err) {
    if (err.isRateLimit) return res.status(429).json({ error: 'rate_limit', message: err.message })
    console.error('[Orbit]', err.response?.status, err.message)
    res.status(502).json({ error: 'fetch_failed', message: err.message })
  }
})

// Best-effort NORAD ID extraction from LL2 launch payload data
function extractNoradId(launch) {
  const payloads = launch.rocket?.spacecraft_stage?.launch_crew ?? []
  if (payloads.length) return null  // crewed, skip
  // Try spacecraft program links or known catalog IDs in launch name
  const match = (launch.name || '').match(/\b(\d{5})\b/)
  return match ? parseInt(match[1], 10) : null
}

export { router as orbitRouter }
