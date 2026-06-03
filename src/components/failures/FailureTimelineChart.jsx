import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import DataSourceTag from '../dashboard/DataSourceTag'

// Decade labels that contain notable events (used for reference lines)
const EVENTS = [
  { decade: '1960s', label: 'Apollo era', y: 1969 },
  { decade: '1980s', label: 'Challenger', y: 1986 },
  { decade: '2000s', label: 'Columbia',   y: 2003 },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const total   = payload.find(p => p.dataKey === 'total')?.value ?? 0
  const partial = payload.find(p => p.dataKey === 'partial')?.value ?? 0
  return (
    <div className="rounded border px-3 py-2 text-[11px] font-mono shadow-xl"
         style={{ background: '#FFFFFF', borderColor: '#B91C1C40' }}>
      <div className="font-bold mb-1" style={{ color: '#B91C1C' }}>{label}</div>
      <div className="text-red-600">{total} total {total === 1 ? 'loss' : 'losses'}</div>
      <div className="text-amber-600">{partial} partial {partial === 1 ? 'failure' : 'failures'}</div>
      <div className="text-gray-500 border-t border-gray-200 mt-1 pt-1">{total + partial} combined</div>
    </div>
  )
}

function RefLabel({ viewBox, label }) {
  return (
    <text x={viewBox.x + 4} y={viewBox.y + 12}
          fill="#64748B" fontSize={8} fontFamily="JetBrains Mono, monospace">
      {label}
    </text>
  )
}

export default function FailureTimelineChart({ stats, fetchedAt }) {
  const chartData = useMemo(() => stats?.byDecade ?? [], [stats?.byDecade])

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#B91C1C' }}>
          Failures by Decade
        </span>
        <span className="text-[10px] font-mono text-gray-500">— stacked total / partial</span>
        <DataSourceTag source="LL2 v2.2.0" fetchedAt={fetchedAt} />
      </div>

      {chartData.length === 0 ? (
        <div className="py-12 text-center text-gray-500 font-mono text-sm">Loading…</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(185,28,28,0.12)" />
            <XAxis
              dataKey="decade"
              tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(185,28,28,0.25)' }}
            />
            <YAxis
              tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(185,28,28,0.25)' }}
              width={34}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(185,28,28,0.08)' }} />
            <Legend
              wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#64748B' }}
              formatter={(v) => v === 'total' ? 'Total Loss' : 'Partial Failure'}
            />
            <Bar dataKey="total"   stackId="a" fill="#B91C1C" name="total"   radius={[0, 0, 0, 0]} />
            <Bar dataKey="partial" stackId="a" fill="#D97706" name="partial" radius={[3, 3, 0, 0]} />

            {EVENTS.map(ev => (
              chartData.some(d => d.decade === ev.decade) && (
                <ReferenceLine
                  key={ev.decade}
                  x={ev.decade}
                  stroke="#6B7280"
                  strokeDasharray="4 3"
                  label={<RefLabel label={ev.label} />}
                />
              )
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
