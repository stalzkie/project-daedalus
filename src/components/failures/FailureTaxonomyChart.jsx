import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import DataSourceTag from '../dashboard/DataSourceTag'

export const STAGE_COLORS = {
  'Stage 1 / Booster':          '#B91C1C',
  'Stage 2':                    '#EA580C',
  'Upper Stage':                '#D97706',
  'Payload / Deployment':       '#CA8A04',
  'Guidance & Navigation':      '#1D4ED8',
  'Software / Avionics':        '#7C3AED',
  'FTS / Range Safety':         '#0D9488',
  'Unknown / Under Investigation': '#6B7280',
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.[0]) return null
  const { name, value } = payload[0]
  return (
    <div className="rounded border px-3 py-2 text-[11px] font-mono shadow-xl"
         style={{ background: '#0d2257', borderColor: '#B91C1C40' }}>
      <div className="text-white font-bold mb-0.5">{name}</div>
      <div className="text-gray-400">{value} events</div>
    </div>
  )
}

export default function FailureTaxonomyChart({ stats, fetchedAt }) {
  const chartData = useMemo(() => {
    if (!stats?.byStage) return []
    return Object.entries(stats.byStage)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [stats?.byStage])

  const total = chartData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#B91C1C' }}>
          Failure Taxonomy
        </span>
        <span className="text-[10px] font-mono text-gray-500">— by failure stage</span>
        <DataSourceTag source="LL2 v2.2.0" fetchedAt={fetchedAt} />
      </div>

      {chartData.length === 0 ? (
        <div className="py-12 text-center text-gray-500 font-mono text-sm">Loading…</div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="w-full lg:w-48 shrink-0" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map(d => (
                    <Cell key={d.name} fill={STAGE_COLORS[d.name] || '#6B7280'} opacity={0.9} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-1 w-full">
            {chartData.map(d => {
              const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : 0
              const color = STAGE_COLORS[d.name] || '#6B7280'
              return (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-[10px] font-mono text-gray-300 flex-1 truncate">{d.name}</span>
                  <span className="text-[10px] font-mono font-bold shrink-0" style={{ color }}>
                    {d.value}
                  </span>
                  <span className="text-[9px] font-mono text-gray-500 w-10 text-right shrink-0">
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
