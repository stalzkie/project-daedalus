import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataSourceTag from './DataSourceTag'

const STATUS_COLOR = {
  Go:   'text-green-700 border-green-300 bg-green-50',
  Hold: 'text-red-700 border-red-300 bg-red-50',
  TBD:  'text-gray-600 border-gray-300 bg-gray-50',
  TBC:  'text-yellow-700 border-yellow-300 bg-yellow-50',
}

function tMinus(netISO) {
  const delta = Math.max(0, new Date(netISO).getTime() - Date.now())
  if (delta === 0) return 'T + 00:00:00'
  const s = Math.floor(delta / 1000)
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `T - ${hh}:${mm}:${ss}`
}

function formatNET(netISO) {
  return new Date(netISO).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short', hour12: false,
  })
}

export default function NextLaunchCard({ launch, fetchedAt }) {
  const navigate = useNavigate()
  const [countdown, setCountdown] = useState(tMinus(launch.net))

  useEffect(() => {
    const id = setInterval(() => setCountdown(tMinus(launch.net)), 1000)
    return () => clearInterval(id)
  }, [launch.net])

  const abbrev = launch.status?.abbrev || 'TBD'
  const statusStyle = STATUS_COLOR[abbrev] || STATUS_COLOR.TBD
  const orbit = launch.mission?.orbit?.abbrev || launch.mission?.orbit_abbrev || '—'
  const missionType = launch.mission?.type || '—'
  const provider = launch.launch_service_provider?.name || '—'
  const vehicleName = launch.rocket?.configuration?.full_name || launch.rocket?.configuration?.name || '—'
  const padName = launch.pad?.name || '—'
  const padLocation = launch.pad?.location?.name || '—'
  const probability = launch.probability != null ? `${launch.probability}%` : 'N/A'

  return (
    <div className="panel p-4">
      {/* Header row */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${statusStyle}`}>
              {abbrev}
            </span>
            <span className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">Next Launch</span>
            <DataSourceTag source="LL2 v2.2.0" fetchedAt={fetchedAt} />
          </div>
          <h1 className="text-xl font-bold text-[#1A1F36] leading-tight truncate" title={launch.name}>
            {launch.name}
          </h1>
          <div className="text-sm text-accent-light mt-0.5">{provider}</div>
        </div>

        {/* Mission patch */}
        {launch.image?.image_url && (
          <div className="shrink-0">
            <img
              src={launch.image.image_url}
              alt="Mission patch"
              className="w-20 h-20 object-cover rounded border border-accent/30 bg-navy-800"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          </div>
        )}
      </div>

      {/* Countdown */}
      <div className="bg-[#F1F5F9] border border-[rgba(0,0,0,0.07)] rounded p-3 mb-4 text-center">
        <div className="font-mono text-3xl font-bold tracking-widest text-[#1A1F36]">{countdown}</div>
        <div className="text-[10px] font-mono text-gray-500 mt-1">
          NET {formatNET(launch.net)}
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-[12px]">
        <Field label="Vehicle" value={vehicleName} />
        <Field label="Launch Site" value={padName} />
        <Field label="Location" value={padLocation} />
        <Field label="Orbit Class" value={orbit} mono />
        <Field label="Mission Type" value={missionType} />
        <Field label="Wx Probability" value={probability} />
        {launch.status?.abbrev === 'Hold' && launch.holdreason && (
          <div className="col-span-full">
            <Field label="Hold Reason" value={launch.holdreason} className="text-red-600" />
          </div>
        )}
      </div>

      {/* Mission description */}
      {launch.mission?.description && (
        <div className="mt-4 border-t border-accent/20 pt-3">
          <div className="text-[10px] font-mono text-accent tracking-widest uppercase mb-1">Mission Overview</div>
          <p className="text-[12px] text-gray-600 leading-relaxed">
            {launch.mission.description}
          </p>
        </div>
      )}

      {/* 3D Orbit button */}
      <div className="mt-3 border-t border-accent/20 pt-3">
        <button
          type="button"
          onClick={() => navigate(`/orbit/${launch.id}`, { state: { launch } })}
          className="flex items-center gap-2 text-[11px] font-mono px-3 py-2 rounded border w-full justify-center
            text-accent hover:text-white hover:bg-accent border-accent/30 hover:border-accent transition-all"
        >
          <span>◎</span>
          View 3D Orbit
        </button>
      </div>
    </div>
  )
}

function Field({ label, value, mono, className }) {
  return (
    <div>
      <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-0.5">{label}</div>
      <div className={`${mono ? 'font-mono' : ''} text-[#1A1F36] font-medium ${className || ''}`}>{value}</div>
    </div>
  )
}
