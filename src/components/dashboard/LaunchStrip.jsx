import { useEffect, useState } from 'react'
import DataSourceTag from './DataSourceTag'

const AGENCY_FLAG = {
  USA: '🇺🇸', FRA: '🇫🇷', RUS: '🇷🇺', CHN: '🇨🇳',
  IND: '🇮🇳', JPN: '🇯🇵', NZL: '🇳🇿', GUF: '🇪🇺',
}

const STATUS_STYLE = {
  Go:   { bg: 'bg-green-700/80',  border: 'border-green-500',  text: 'text-green-200' },
  Hold: { bg: 'bg-red-800/80',    border: 'border-red-500',    text: 'text-red-200'   },
  TBD:  { bg: 'bg-gray-700/80',   border: 'border-gray-500',   text: 'text-gray-300'  },
  TBC:  { bg: 'bg-yellow-800/80', border: 'border-yellow-500', text: 'text-yellow-200'},
}

function tMinus(netISO) {
  const delta = Math.max(0, new Date(netISO).getTime() - Date.now())
  const s = Math.floor(delta / 1000)
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return delta === 0 ? 'T+00:00:00' : `T-${hh}:${mm}:${ss}`
}

function StripCard({ launch, isActive, onClick }) {
  const [countdown, setCountdown] = useState(tMinus(launch.net))

  useEffect(() => {
    const id = setInterval(() => setCountdown(tMinus(launch.net)), 1000)
    return () => clearInterval(id)
  }, [launch.net])

  const abbrev = launch.status?.abbrev || 'TBD'
  const style = STATUS_STYLE[abbrev] || STATUS_STYLE.TBD
  const countryCode = launch.launch_service_provider?.country_code
  const flag = AGENCY_FLAG[countryCode] || '🌍'
  const missionName = launch.mission?.name || launch.name.split('|')[1]?.trim() || '—'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex flex-col gap-1 p-3 rounded min-w-[180px] max-w-[180px] text-left
        border transition-all shrink-0 cursor-pointer
        ${isActive
          ? 'border-accent bg-accent/20 shadow-[0_0_12px_rgba(27,108,168,0.4)]'
          : 'border-[rgba(27,108,168,0.3)] bg-[rgba(13,34,87,0.5)] hover:border-accent/60 hover:bg-accent/10'
        }
      `}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${style.bg} ${style.border} ${style.text}`}>
          {abbrev}
        </span>
        <span className="text-lg leading-none" title={launch.launch_service_provider?.name}>{flag}</span>
      </div>

      <div className="text-[11px] font-semibold text-white leading-snug line-clamp-2" title={launch.name}>
        {missionName}
      </div>

      <div className="text-[10px] text-gray-400 truncate" title={launch.rocket?.configuration?.name}>
        {launch.rocket?.configuration?.name || '—'}
      </div>

      <div className={`font-mono text-[11px] font-semibold ${abbrev === 'Go' ? 'text-green-300' : 'text-gray-300'}`}>
        {countdown}
      </div>
    </button>
  )
}

export default function LaunchStrip({ launches, activeId, onSelect, fetchedAt }) {
  return (
    <div className="panel p-3">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-[10px] font-mono text-accent tracking-widest uppercase">Upcoming Launches</span>
        <span className="text-[10px] font-mono text-gray-500">— {launches.length} missions</span>
        <DataSourceTag source="LL2 v2.2.0" fetchedAt={fetchedAt} />
      </div>

      <div className="launch-strip flex gap-2 overflow-x-auto pb-1">
        {launches.map((l) => (
          <StripCard
            key={l.id}
            launch={l}
            isActive={l.id === activeId}
            onClick={() => onSelect(l.id)}
          />
        ))}
      </div>
    </div>
  )
}
