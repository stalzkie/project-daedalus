import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import DataSourceTag from '../dashboard/DataSourceTag'

const AGENCY_COLORS = [
  '#1B6CA8', '#1A7F4B', '#B45309', '#B91C1C',
  '#7C3AED', '#0891B2', '#D97706', '#059669',
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-accent/30 rounded p-2 text-[11px] font-mono shadow-lg"
         style={{ color: '#1A1F36' }}>
      <div className="text-accent font-bold mb-1">Year {label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey}: {p.value}%
        </div>
      ))}
    </div>
  )
}

export default function SuccessRateChart({ byYearAgency, fetchedAt, loading, partial, fetched, total }) {
  const [hiddenAgencies, setHiddenAgencies] = useState(new Set())

  const { chartData, agencies } = useMemo(() => {
    if (!byYearAgency?.length) return { chartData: [], agencies: [] }

    // Rebuild the agency→year→{total,success} map from pre-aggregated server data
    const agencyYearMap = {}
    byYearAgency.forEach(({ agency, year, total, success }) => {
      if (!agencyYearMap[agency]) agencyYearMap[agency] = {}
      agencyYearMap[agency][year] = { total, success }
    })

    const agencies = Object.keys(agencyYearMap)
    const yearSet  = new Set()
    agencies.forEach(a => Object.keys(agencyYearMap[a]).forEach(y => yearSet.add(Number(y))))
    const years = [...yearSet].sort((a, b) => a - b)

    const chartData = years.map(year => {
      const row = { year }
      agencies.forEach(agency => {
        const d = agencyYearMap[agency][year]
        if (d && d.total > 0) row[agency] = Math.round((d.success / d.total) * 100)
      })
      return row
    })

    return { chartData, agencies }
  }, [byYearAgency])

  function toggleAgency(agency) {
    setHiddenAgencies(prev => {
      const next = new Set(prev)
      if (next.has(agency)) next.delete(agency)
      else next.add(agency)
      return next
    })
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-mono text-accent tracking-widest uppercase">Success Rate by Year</span>
        <span className="text-[10px] font-mono text-gray-500">— per agency, all launches</span>
        {partial && fetched != null && total != null && (
          <span className="text-[9px] font-mono text-amber-600 ml-1 animate-pulse">
            {fetched.toLocaleString()}/{total.toLocaleString()} loaded…
          </span>
        )}
        <DataSourceTag source="LL2 v2.2.0 history" fetchedAt={fetchedAt} />
      </div>

      {agencies.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {agencies.map((a, i) => (
            <button
              key={a}
              type="button"
              onClick={() => toggleAgency(a)}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded border transition-all"
              style={{
                borderColor: AGENCY_COLORS[i % AGENCY_COLORS.length] + '80',
                color: hiddenAgencies.has(a) ? '#4B5563' : AGENCY_COLORS[i % AGENCY_COLORS.length],
                background: hiddenAgencies.has(a) ? 'transparent' : AGENCY_COLORS[i % AGENCY_COLORS.length] + '15',
                textDecoration: hiddenAgencies.has(a) ? 'line-through' : 'none',
              }}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {(loading || partial) && !byYearAgency?.length && (
        <div className="py-12 text-center text-gray-400 font-mono text-sm animate-pulse">
          {total ? `Loaded ${fetched?.toLocaleString()} / ${total.toLocaleString()} launches…` : 'Aggregating launch history…'}
        </div>
      )}
      {!loading && !partial && chartData.length === 0 && (
        <div className="py-12 text-center text-gray-500 font-mono text-sm">
          No launch data in current filter set.
        </div>
      )}

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" />
            <XAxis
              dataKey="year"
              tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(27,108,168,0.3)' }}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={v => `${v}%`}
              tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(27,108,168,0.3)' }}
              width={38}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#64748B' }}
            />
            {agencies.map((agency, i) =>
              !hiddenAgencies.has(agency) && (
                <Line
                  key={agency}
                  type="monotone"
                  dataKey={agency}
                  stroke={AGENCY_COLORS[i % AGENCY_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: AGENCY_COLORS[i % AGENCY_COLORS.length] }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              )
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
