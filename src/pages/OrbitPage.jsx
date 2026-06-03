import { lazy, Suspense, useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import OrbitLoadingFallback from '../components/orbit/OrbitLoadingFallback'

const OrbitViewer = lazy(() => import('../components/orbit/OrbitViewer'))

const ORBIT_DEFAULTS = {
  LEO:   { apogee_km: 400,    perigee_km: 400,   inclination_deg: 51.6 },
  VLEO:  { apogee_km: 340,    perigee_km: 330,   inclination_deg: 53   },
  SSO:   { apogee_km: 550,    perigee_km: 540,   inclination_deg: 97.7 },
  ISS:   { apogee_km: 420,    perigee_km: 408,   inclination_deg: 51.6 },
  MEO:   { apogee_km: 20200,  perigee_km: 20100, inclination_deg: 55   },
  GTO:   { apogee_km: 35786,  perigee_km: 200,   inclination_deg: 27   },
  GEO:   { apogee_km: 35786,  perigee_km: 35786, inclination_deg: 0.1  },
  HEO:   { apogee_km: 39000,  perigee_km: 500,   inclination_deg: 63.4 },
  POLAR: { apogee_km: 600,    perigee_km: 590,   inclination_deg: 90   },
  TLI:   { apogee_km: 380000, perigee_km: 200,   inclination_deg: 28   },
}

// Build a full orbitData object from a raw LL2 launch record (available in route state)
function launchToOrbitData(launch) {
  const orbitAbbrev = launch.mission?.orbit?.abbrev || 'LEO'
  const def = ORBIT_DEFAULTS[orbitAbbrev] || ORBIT_DEFAULTS.LEO
  return {
    launchId:           launch.id,
    launchName:         launch.name,
    orbitAbbrev,
    orbitElements: {
      apogee_km:        launch.mission?.orbit?.apogee       ?? def.apogee_km,
      perigee_km:       launch.mission?.orbit?.perigee      ?? def.perigee_km,
      inclination_deg:  launch.mission?.orbit?.inclination  ?? def.inclination_deg,
      raan_deg:         launch.mission?.orbit?.raan         ?? 0,
      arg_perigee_deg:  launch.mission?.orbit?.arg_of_perigee ?? 0,
      mean_anomaly_deg: 0,
    },
    tle: null,
    launchSite: {
      lat:  launch.pad?.latitude  ? parseFloat(launch.pad.latitude)  : null,
      lng:  launch.pad?.longitude ? parseFloat(launch.pad.longitude) : null,
      name: launch.pad?.name || launch.pad?.location?.name || 'Launch Site',
    },
    status:             launch.status?.abbrev    || null,
    net:                launch.net               || null,
    imageUrl:           launch.image?.image_url  || null,
    missionDescription: launch.mission?.description || null,
    vehicleName:        launch.rocket?.configuration?.full_name
                        || launch.rocket?.configuration?.name || null,
    provider:           launch.launch_service_provider?.name || null,
  }
}

export default function OrbitPage() {
  const { launchId } = useParams()
  const navigate     = useNavigate()
  const location     = useLocation()

  // If we navigated here from the dashboard / history drawer, the full launch
  // object is in route state — use it immediately without an API round-trip.
  const stateOrbitData = useMemo(() => {
    const launch = location.state?.launch
    return launch ? launchToOrbitData(launch) : null
  }, [location.state?.launch])

  const [apiOrbitData, setApiOrbitData] = useState(null)
  const [loading,      setLoading]      = useState(!stateOrbitData)
  const [error,        setError]        = useState(null)

  // Always fetch from the API in the background so TLE / any server-enriched
  // data supplements what we got from route state (or provides it for direct loads).
  useEffect(() => {
    setError(null)
    axios.get(`/api/orbit/${launchId}`)
      .then(r => { setApiOrbitData(r.data); setLoading(false) })
      .catch(e => {
        if (!stateOrbitData) setError(e.response?.data?.message || e.message)
        setLoading(false)
      })
  }, [launchId])

  // Merge: state data (rich, immediate) + API data (adds TLE, server extras).
  // State data wins for mission description / image since those aren't always
  // in the server cache yet. API data wins for TLE.
  const orbitData = useMemo(() => {
    if (!stateOrbitData && !apiOrbitData) return null
    if (!stateOrbitData) return apiOrbitData
    if (!apiOrbitData)   return stateOrbitData
    return {
      ...apiOrbitData,
      // Keep richer fields from the live launch object
      imageUrl:           stateOrbitData.imageUrl           || apiOrbitData.imageUrl,
      missionDescription: stateOrbitData.missionDescription || apiOrbitData.missionDescription,
      vehicleName:        stateOrbitData.vehicleName        || apiOrbitData.vehicleName,
      provider:           stateOrbitData.provider           || apiOrbitData.provider,
    }
  }, [stateOrbitData, apiOrbitData])

  const displayName = orbitData?.launchName || launchId

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 100 }}>

      {/* Top overlay bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        pointerEvents: 'none',
      }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            pointerEvents: 'auto',
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#D1D5DB',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            cursor: 'pointer',
            padding: '4px 10px',
            borderRadius: 4,
          }}
        >
          ← Back
        </button>
        <span style={{ color: '#fff', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </span>
        {orbitData?.orbitAbbrev && (
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
            padding: '2px 8px', borderRadius: 4,
            border: '1px solid rgba(27,108,168,0.6)',
            background: 'rgba(27,108,168,0.25)', color: '#93C5FD',
            flexShrink: 0,
          }}>
            {orbitData.orbitAbbrev}
          </span>
        )}
        <span style={{
          marginLeft: 'auto', flexShrink: 0,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#6B7280',
        }}>
          PROJECT DAEDALUS · 3D ORBIT VIEWER
        </span>
      </div>

      {/* Show loading only when we have no state data to display immediately */}
      {loading && !stateOrbitData && <OrbitLoadingFallback height="100vh" />}

      {/* API error — only fatal if we also have no state data */}
      {error && !orbitData && (
        <div className="flex items-center justify-center" style={{ height: '100vh' }}>
          <div className="text-center font-mono">
            <div className="text-red-400 text-sm mb-2">Failed to load orbit data</div>
            <div className="text-gray-500 text-[11px]">{error}</div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-4 text-[11px] px-3 py-1.5 rounded border border-accent/40 text-gray-300 hover:text-white"
            >
              ← Go Back
            </button>
          </div>
        </div>
      )}

      {orbitData && (
        <Suspense fallback={<OrbitLoadingFallback height="100vh" />}>
          <OrbitViewer
            launchId={launchId}
            orbitData={orbitData}
            fullscreen
          />
        </Suspense>
      )}
    </div>
  )
}
