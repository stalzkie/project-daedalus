import { lazy, Suspense, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import OrbitLoadingFallback from '../components/orbit/OrbitLoadingFallback'

const OrbitViewer = lazy(() => import('../components/orbit/OrbitViewer'))

export default function OrbitPage() {
  const { launchId } = useParams()
  const navigate     = useNavigate()
  const [orbitData,  setOrbitData]  = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  useEffect(() => {
    setLoading(true); setError(null)
    axios.get(`/api/orbit/${launchId}`)
      .then(r => { setOrbitData(r.data); setLoading(false) })
      .catch(e => { setError(e.response?.data?.message || e.message); setLoading(false) })
  }, [launchId])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative', overflow: 'hidden' }}>

      {/* Top overlay bar */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)',
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          pointerEvents: 'none',
        }}
      >
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
        <span className="font-mono text-sm font-bold text-white truncate" style={{ color: '#fff', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
          {orbitData?.launchName || launchId}
        </span>
        {orbitData?.orbitAbbrev && (
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
            padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(27,108,168,0.6)',
            background: 'rgba(27,108,168,0.25)', color: '#93C5FD',
          }}>
            {orbitData.orbitAbbrev}
          </span>
        )}
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#6B7280',
          pointerEvents: 'none',
        }}>
          PROJECT GARUDA · 3D ORBIT VIEWER
        </span>
      </div>

      {/* Viewer area */}
      {loading && <OrbitLoadingFallback height="100vh" />}

      {error && (
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

      {!loading && !error && orbitData && (
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
