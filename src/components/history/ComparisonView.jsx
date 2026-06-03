import { useState, useCallback } from 'react'

// Parameter groups for comparison
const PARAM_GROUPS = [
  {
    id: 'vehicle', label: 'Vehicle',
    params: [
      { key: 'vehicleFull',   label: 'Full Name',    get: l => l.rocket?.configuration?.full_name || l.rocket?.configuration?.name },
      { key: 'manufacturer',  label: 'Manufacturer', get: l => l.rocket?.configuration?.manufacturer?.name },
      { key: 'country',       label: 'Country',      get: l => l.rocket?.configuration?.manufacturer?.country_code },
      { key: 'stages',        label: 'Stages',       get: l => l.rocket?.configuration?.stages,             numeric: true, higherBetter: false },
      { key: 'engineCount',   label: 'Engine Count', get: l => l.rocket?.configuration?.engine_count,        numeric: true, higherBetter: true  },
    ],
  },
  {
    id: 'performance', label: 'Performance',
    params: [
      { key: 'thrustKN',      label: 'Liftoff Thrust (kN)', get: l => l.rocket?.configuration?.thrust_kN,        numeric: true, higherBetter: true, fmt: v => v.toLocaleString() },
      { key: 'payloadLEO',    label: 'Payload LEO (kg)',     get: l => l.rocket?.configuration?.payload_leo_kg,   numeric: true, higherBetter: true, fmt: v => v.toLocaleString() },
      { key: 'payloadGTO',    label: 'Payload GTO (kg)',     get: l => l.rocket?.configuration?.payload_gto_kg,   numeric: true, higherBetter: true, fmt: v => v.toLocaleString() },
      { key: 'fairingDiam',   label: 'Fairing Ø (m)',        get: l => l.rocket?.configuration?.fairing_diameter_m, numeric: true, higherBetter: true },
    ],
  },
  {
    id: 'trajectory', label: 'Trajectory',
    params: [
      { key: 'orbit',         label: 'Target Orbit',    get: l => l.mission?.orbit?.name },
      { key: 'orbitAbbrev',   label: 'Orbit Class',     get: l => l.mission?.orbit?.abbrev },
      { key: 'missionType',   label: 'Mission Type',    get: l => l.mission?.type },
    ],
  },
  {
    id: 'payload', label: 'Payload',
    params: [
      { key: 'missionName',   label: 'Mission Name',    get: l => l.mission?.name },
      { key: 'program',       label: 'Program',         get: l => l.program?.[0]?.name },
      { key: 'padName',       label: 'Launch Pad',      get: l => l.pad?.name },
      { key: 'padLocation',   label: 'Location',        get: l => l.pad?.location?.name },
    ],
  },
  {
    id: 'outcome', label: 'Outcome',
    params: [
      { key: 'status',        label: 'Status',          get: l => l.status?.name },
      { key: 'provider',      label: 'Provider',        get: l => l.launch_service_provider?.name },
      { key: 'net',           label: 'NET Date',        get: l => l.net ? new Date(l.net).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }) : null },
      { key: 'probability',   label: 'Wx Probability',  get: l => l.probability != null ? l.probability : null, numeric: true, higherBetter: true, fmt: v => `${v}%` },
    ],
  },
]

function deltaClass(vals, idx, higherBetter) {
  const nums = vals.filter(v => typeof v === 'number')
  if (nums.length < 2) return ''
  const v = vals[idx]
  if (typeof v !== 'number') return ''
  const max = Math.max(...nums)
  const min = Math.min(...nums)
  if (max === min) return ''
  if (v === max) return higherBetter ? 'text-green-600' : 'text-red-600'
  if (v === min) return higherBetter ? 'text-red-600' : 'text-green-600'
  return 'text-yellow-600'
}

function exportCSV(launches) {
  const rows = [['Parameter', ...launches.map(l => `"${l.name}"`)]]
  PARAM_GROUPS.forEach(group => {
    rows.push([`--- ${group.label} ---`, ...launches.map(() => '')])
    group.params.forEach(({ label, get, fmt }) => {
      rows.push([label, ...launches.map(l => {
        const v = get(l)
        if (v == null) return '—'
        return fmt ? fmt(v) : String(v)
      })])
    })
  })
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `daedalus-comparison-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ComparisonView({ launches, onRemove }) {
  const [collapsed, setCollapsed] = useState({})

  const toggleGroup = useCallback(id => {
    setCollapsed(c => ({ ...c, [id]: !c[id] }))
  }, [])

  if (!launches || launches.length < 2) return null

  return (
    <div className="panel" id="comparison-view">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-accent/30" style={{ background: '#EDF1F7' }}>
        <div className="flex items-center px-3 py-2 gap-3 border-b border-accent/20">
          <span className="text-[10px] font-mono text-accent tracking-widest uppercase">
            Mission Comparison ({launches.length})
          </span>
          <button
            type="button"
            onClick={() => exportCSV(launches)}
            className="ml-auto text-[10px] font-mono px-2 py-1 border border-accent/30 rounded text-gray-400 hover:text-[#1A1F36] hover:border-accent/60 hover:bg-gray-100 transition-colors"
          >
            ↓ Export CSV
          </button>
        </div>

        {/* Mission name header row */}
        <div className="grid gap-px" style={{ gridTemplateColumns: `180px repeat(${launches.length}, 1fr)` }}>
          <div className="px-3 py-2 text-[9px] font-mono text-gray-500 uppercase tracking-widest">Parameter</div>
          {launches.map(l => (
            <div key={l.id} className="px-2 py-2 border-l border-accent/20">
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-[#1A1F36] leading-tight truncate" title={l.name}>
                    {l.mission?.name || l.name}
                  </div>
                  <div className="text-[9px] font-mono text-gray-500 mt-0.5">
                    {l.rocket?.configuration?.name} · {l.status?.abbrev}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(l.id)}
                  className="text-gray-600 hover:text-red-400 text-[10px] leading-none shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Parameter groups */}
      {PARAM_GROUPS.map(group => (
        <div key={group.id} className="border-b border-accent/10">
          {/* Group header (collapsible) */}
          <button
            type="button"
            onClick={() => toggleGroup(group.id)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono text-accent uppercase tracking-widest hover:bg-gray-50 transition-colors"
          >
            <span>{collapsed[group.id] ? '▶' : '▼'}</span>
            {group.label}
          </button>

          {!collapsed[group.id] && group.params.map(param => {
            const vals = launches.map(l => param.get(l))
            const hasData = vals.some(v => v != null)
            if (!hasData) return null

            return (
              <div
                key={param.key}
                className="grid gap-px border-t border-accent/10"
                style={{ gridTemplateColumns: `180px repeat(${launches.length}, 1fr)` }}
              >
                <div className="px-3 py-1.5 text-[10px] font-mono text-gray-500 bg-[#F8FAFC]">
                  {param.label}
                </div>
                {vals.map((v, idx) => {
                  const display = v == null ? '—' : (param.fmt ? param.fmt(v) : String(v))
                  const cls = param.numeric ? deltaClass(vals, idx, param.higherBetter) : 'text-gray-600'
                  return (
                    <div key={launches[idx].id} className="px-2 py-1.5 border-l border-accent/10">
                      <span className={`text-[11px] ${param.numeric ? 'font-mono' : ''} ${cls}`}>
                        {display}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-4 px-3 py-2 text-[9px] font-mono text-gray-600">
        <span className="text-green-600">■</span> Higher / better
        <span className="text-red-600">■</span> Lower / worse
        <span className="text-yellow-600">■</span> Intermediate
        <span className="text-gray-400">■</span> Categorical (no delta)
      </div>
    </div>
  )
}
