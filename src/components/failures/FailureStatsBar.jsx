import DataSourceTag from '../dashboard/DataSourceTag'

const CARDS = [
  { key: 'totalFailures', label: 'Total Failures',     color: '#B91C1C' },
  { key: 'totalPartial',  label: 'Partial Failures',   color: '#D97706' },
  { key: 'rudCount',      label: 'RUD Events',         color: '#991B1B' },
  { key: 'ftsCount',      label: 'FTS Activations',    color: '#B45309' },
  { key: 'failureRate',   label: 'Historical Rate',    color: '#6B7280', suffix: '%' },
]

export default function FailureStatsBar({ stats, fetchedAt }) {
  return (
    <div className="panel p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#B91C1C' }}>
          Failure Metrics
        </span>
        <DataSourceTag source="Space-Track SATCAT (rapid-decay payloads)" fetchedAt={fetchedAt} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CARDS.map(({ key, label, color, suffix = '' }) => {
          const val = stats?.[key]
          return (
            <div
              key={key}
              className="rounded border p-3 flex flex-col gap-1"
              style={{ borderColor: color + '40', background: color + '10' }}
            >
              <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest leading-tight">
                {label}
              </span>
              <span className="font-mono text-2xl font-bold" style={{ color }}>
                {val == null ? (
                  <span className="text-gray-600 text-sm">—</span>
                ) : (
                  `${typeof val === 'number' && key !== 'failureRate'
                     ? val.toLocaleString()
                     : val}${suffix}`
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
