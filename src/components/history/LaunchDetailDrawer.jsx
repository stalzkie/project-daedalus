import { useEffect, useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import OrbitLoadingFallback from '../orbit/OrbitLoadingFallback'

const OrbitViewer = lazy(() => import('../orbit/OrbitViewer'))

const STATUS_COLOR = {
  Success:          'text-green-400 border-green-600 bg-green-900/30',
  Failure:          'text-red-400 border-red-600 bg-red-900/30',
  'Partial Failure':'text-orange-400 border-orange-600 bg-orange-900/30',
  Go:               'text-green-400 border-green-600 bg-green-900/30',
  Hold:             'text-red-400 border-red-600 bg-red-900/30',
  TBD:              'text-gray-400 border-gray-600 bg-gray-900/30',
}

function Field({ label, value, mono }) {
  if (!value && value !== 0) return null
  return (
    <div>
      <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-0.5">{label}</div>
      <div className={`text-[12px] text-white ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

function SpecGrid({ cfg }) {
  if (!cfg) return null
  const specs = [
    ['Stages', cfg.max_stage],
    ['Engines', cfg.engine_count],
    ['Thrust', cfg.to_thrust != null ? `${cfg.to_thrust.toLocaleString()} kN` : null],
    ['LEO Cap.', cfg.leo_capacity != null ? `${cfg.leo_capacity.toLocaleString()} kg` : null],
    ['GTO Cap.', cfg.gto_capacity != null ? `${cfg.gto_capacity.toLocaleString()} kg` : null],
    ['Fairing Ø', cfg.fairing_diameter_m != null ? `${cfg.fairing_diameter_m} m` : null],
  ].filter(([, v]) => v != null)

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
      {specs.map(([label, value]) => (
        <Field key={label} label={label} value={value} mono />
      ))}
    </div>
  )
}

export default function LaunchDetailDrawer({ launch, onClose }) {
  const open     = !!launch
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('details')

  // Reset tab when new launch is opened
  useEffect(() => { if (open) setActiveTab('details') }, [launch?.id, open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const abbrev = launch?.status?.abbrev || 'TBD'
  const statusStyle = STATUS_COLOR[launch?.status?.name] || STATUS_COLOR[abbrev] || STATUS_COLOR.TBD
  const cfg = launch?.rocket?.configuration

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 right-0 w-[480px] max-w-full z-50 flex flex-col
          border-l border-accent/30 overflow-y-auto transition-transform duration-300
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: '#0B1F4B' }}
      >
        {!launch ? null : (
          <>
            {/* Tab bar */}
            <div className="flex border-b border-accent/20 shrink-0 px-4 pt-3 gap-1">
              {['details', '3d orbit'].map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className="text-[10px] font-mono px-3 py-1.5 rounded-t border-b-2 transition-all capitalize"
                  style={activeTab === tab
                    ? { borderColor: '#1B6CA8', color: '#60A5FA', background: 'rgba(27,108,168,0.1)' }
                    : { borderColor: 'transparent', color: '#6B7280' }
                  }
                >
                  {tab === '3d orbit' ? '◎ 3D Orbit' : '≡ Details'}
                </button>
              ))}
              <button
                type="button"
                onClick={() => navigate(`/orbit/${launch.id}`)}
                className="ml-auto text-[9px] font-mono px-2 py-1 rounded border text-gray-400 hover:text-white transition-colors mb-1"
                style={{ borderColor: 'rgba(27,108,168,0.3)' }}
              >
                ↗ Fullscreen
              </button>
            </div>

            {/* Header */}
            <div className="flex items-start gap-3 p-4 border-b border-accent/20 shrink-0">
              {launch.image?.image_url && (
                <img
                  src={launch.image.image_url}
                  alt="Mission patch"
                  className="w-16 h-16 object-cover rounded border border-accent/30 shrink-0"
                  onError={e => { e.target.style.display = 'none' }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${statusStyle}`}>
                    {abbrev}
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">
                    {launch.net ? new Date(launch.net).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                  </span>
                </div>
                <h2 className="text-base font-bold text-white leading-snug">{launch.name}</h2>
                <div className="text-[12px] text-accent mt-0.5">{launch.launch_service_provider?.name}</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-500 hover:text-white text-xl leading-none shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* 3D Orbit tab */}
            {activeTab === '3d orbit' && (
              <div className="flex-1 overflow-hidden">
                <Suspense fallback={<OrbitLoadingFallback height={400} />}>
                  <OrbitViewer
                    launchId={launch.id}
                    orbitData={{
                      orbitElements: launch.mission?.orbit
                        ? {
                            apogee_km:       launch.mission.orbit.apogee   ?? 400,
                            perigee_km:      launch.mission.orbit.perigee  ?? 400,
                            inclination_deg: launch.mission.orbit.inclination ?? 51.6,
                            raan_deg:         0,
                            arg_perigee_deg:  0,
                            mean_anomaly_deg: 0,
                          }
                        : null,
                      orbitAbbrev: launch.mission?.orbit?.abbrev || 'LEO',
                      launchName:  launch.name,
                      launchSite: {
                        lat:  launch.pad?.latitude  ? parseFloat(launch.pad.latitude)  : null,
                        lng:  launch.pad?.longitude ? parseFloat(launch.pad.longitude) : null,
                        name: launch.pad?.name || 'Launch Site',
                      },
                      tle: null,
                    }}
                    height={400}
                  />
                </Suspense>
              </div>
            )}

            {/* Details tab */}
            {activeTab !== '3d orbit' && (
            <div className="p-4 space-y-5 flex-1">
              {/* Mission details */}
              <section>
                <SectionTitle>Mission</SectionTitle>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Field label="Mission Name" value={launch.mission?.name} />
                  <Field label="Type" value={launch.mission?.type} />
                  <Field label="Orbit" value={launch.mission?.orbit?.name} />
                  <Field label="Orbit Abbrev" value={launch.mission?.orbit?.abbrev} mono />
                </div>
                {launch.mission?.description && (
                  <p className="mt-2 text-[11px] text-gray-300 leading-relaxed border-t border-accent/10 pt-2">
                    {launch.mission.description}
                  </p>
                )}
              </section>

              {/* Launch site */}
              <section>
                <SectionTitle>Launch Site</SectionTitle>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Field label="Pad" value={launch.pad?.name} />
                  <Field label="ICAO" value={launch.pad?.icao} mono />
                  <Field label="Location" value={launch.pad?.location?.name} />
                  <Field label="Coordinates" value={
                    launch.pad?.latitude && launch.pad?.longitude
                      ? `${parseFloat(launch.pad.latitude).toFixed(4)}°, ${parseFloat(launch.pad.longitude).toFixed(4)}°`
                      : null
                  } mono />
                </div>
              </section>

              {/* Vehicle */}
              <section>
                <SectionTitle>Vehicle · {cfg?.full_name || cfg?.name || '—'}</SectionTitle>
                <SpecGrid cfg={cfg} />
                {cfg?.manufacturer && (
                  <div className="mt-2 text-[10px] font-mono text-gray-500">
                    Mfr: {cfg.manufacturer.name} · {cfg.manufacturer.country_code}
                  </div>
                )}
              </section>

              {/* Provider */}
              <section>
                <SectionTitle>Launch Service Provider</SectionTitle>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Field label="Agency" value={launch.launch_service_provider?.name} />
                  <Field label="Type" value={launch.launch_service_provider?.type} />
                  <Field label="Country" value={launch.launch_service_provider?.country_code} mono />
                </div>
              </section>

              {/* Status / window */}
              <section>
                <SectionTitle>Timeline</SectionTitle>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Field label="NET" value={launch.net ? new Date(launch.net).toISOString() : null} mono />
                  <Field label="Window Start" value={launch.window_start ? new Date(launch.window_start).toISOString() : null} mono />
                  <Field label="Window End"   value={launch.window_end   ? new Date(launch.window_end).toISOString()   : null} mono />
                  <Field label="Probability"  value={launch.probability != null ? `${launch.probability}%` : null} />
                </div>
                {launch.holdreason && (
                  <div className="mt-2 text-[11px] text-red-300 font-mono">Hold: {launch.holdreason}</div>
                )}
              </section>
            </div>
            )}
          </>
        )}
      </aside>
    </>
  )
}

function SectionTitle({ children }) {
  return (
    <div className="text-[10px] font-mono text-accent tracking-widest uppercase mb-2 border-b border-accent/20 pb-1">
      {children}
    </div>
  )
}
