import DataSourceTag from './DataSourceTag'

function SpecRow({ label, value, unit, highlight }) {
  const displayValue = value != null ? value : '—'
  return (
    <div className={`flex items-center justify-between px-3 py-2 border-b border-accent/10 last:border-0 ${highlight ? 'bg-accent/5' : ''}`}>
      <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">{label}</span>
      <span className="font-mono text-sm font-semibold text-[#1A1F36]">
        {displayValue !== '—' ? (
          <>{displayValue}<span className="text-[10px] text-gray-400 ml-1">{unit}</span></>
        ) : (
          <span className="text-gray-400">N/A</span>
        )}
      </span>
    </div>
  )
}

function StatBar({ value, max, color = 'bg-accent' }) {
  if (value == null) return <div className="h-1 bg-gray-200 rounded" />
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="h-1 bg-gray-100 rounded overflow-hidden">
      <div className={`h-full ${color} rounded transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function VehicleSpecs({ launch, fetchedAt }) {
  const cfg = launch?.rocket?.configuration
  if (!cfg) {
    return (
      <div className="panel p-4 flex items-center justify-center text-gray-500 text-sm font-mono">
        No vehicle config available
      </div>
    )
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-mono text-accent tracking-widest uppercase">Vehicle Specs</span>
        <span className="text-[10px] font-mono text-gray-500">— {cfg.full_name || cfg.name}</span>
        <DataSourceTag source="LL2 v2.2.0 config" fetchedAt={fetchedAt} />
      </div>

      <div className="text-[10px] font-mono text-gray-500 mb-2 px-3">
        {cfg.manufacturer?.name} · {cfg.manufacturer?.country_code}
      </div>

      <div className="divide-y divide-accent/10">
        <SpecRow label="Engine Count" value={cfg.engine_count} unit="engines" />
        <SpecRow label="Thrust (SL)" value={cfg.to_thrust != null ? cfg.to_thrust.toLocaleString() : null} unit="kN" highlight />
        <SpecRow label="Stages" value={cfg.max_stage} unit="stage(s)" />
        <SpecRow label="Payload LEO" value={cfg.leo_capacity != null ? cfg.leo_capacity.toLocaleString() : null} unit="kg" highlight />
        <SpecRow label="Payload GTO" value={cfg.gto_capacity != null ? cfg.gto_capacity.toLocaleString() : null} unit="kg" />
        <SpecRow label="Fairing Ø" value={cfg.fairing_diameter_m} unit="m" highlight />
      </div>

      {/* Mini visual payload bar chart */}
      <div className="mt-4 px-3 space-y-2">
        <div>
          <div className="flex justify-between text-[9px] font-mono text-gray-500 mb-0.5">
            <span>LEO CAPACITY</span>
            <span>{cfg.leo_capacity != null ? `${(cfg.leo_capacity / 1000).toFixed(1)} t` : 'N/A'}</span>
          </div>
          <StatBar value={cfg.leo_capacity} max={65000} color="bg-accent" />
        </div>
        <div>
          <div className="flex justify-between text-[9px] font-mono text-gray-500 mb-0.5">
            <span>GTO CAPACITY</span>
            <span>{cfg.gto_capacity != null ? `${(cfg.gto_capacity / 1000).toFixed(1)} t` : 'N/A'}</span>
          </div>
          <StatBar value={cfg.gto_capacity} max={27000} color="bg-blue-400" />
        </div>
        <div>
          <div className="flex justify-between text-[9px] font-mono text-gray-500 mb-0.5">
            <span>THRUST</span>
            <span>{cfg.to_thrust != null ? `${(cfg.to_thrust / 1000).toFixed(1)} MN` : 'N/A'}</span>
          </div>
          <StatBar value={cfg.to_thrust} max={85000} color="bg-orange-400" />
        </div>
      </div>
    </div>
  )
}
