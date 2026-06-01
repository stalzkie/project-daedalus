import { useMemo, useState } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import DataSourceTag from '../dashboard/DataSourceTag'

// Approximate apogee km by orbit class
const ORBIT_APOGEE = {
  VLEO: 350, LEO: 408, ISS: 408, SSO: 550, POLAR: 600,
  MEO: 20200, GTO: 35786, GEO: 35786, ES_L1: 1_500_000,
  HEO: 40_000, TLI: 384_400, BEO: 600_000,
}

// Palette — deterministic per agency name
const AGENCY_PALETTE = [
  '#1B6CA8', '#1A7F4B', '#B45309', '#B91C1C',
  '#7C3AED', '#0891B2', '#D97706', '#059669', '#64748B',
]
const agencyColor = (() => {
  const memo = {}; let idx = 0
  return (name) => {
    if (!memo[name]) memo[name] = AGENCY_PALETTE[idx++ % AGENCY_PALETTE.length]
    return memo[name]
  }
})()

// Custom scatter dot — shape by orbit class
function CustomDot(props) {
  const { cx, cy, fill, payload } = props
  const orbit = payload?.orbit
  const r = 5

  if (['GEO', 'GTO', 'ES_L1'].includes(orbit)) {
    return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={fill} opacity={0.8} />
  }
  if (['HEO', 'TLI', 'BEO'].includes(orbit)) {
    const h = r * 1.5
    return <polygon points={`${cx},${cy - h} ${cx + r},${cy + h / 2} ${cx - r},${cy + h / 2}`} fill={fill} opacity={0.8} />
  }
  return <circle cx={cx} cy={cy} r={r} fill={fill} opacity={0.8} />
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <div className="bg-navy-800 border border-accent/40 rounded p-2 text-[10px] font-mono shadow-xl max-w-[220px]"
         style={{ background: '#0d2257' }}>
      <div className="text-white font-bold mb-1 leading-tight">{d.name}</div>
      <div className="text-gray-400">{d.agency}</div>
      <div className="text-accent mt-0.5">Orbit: <span className="text-white">{d.orbit}</span></div>
      <div className="text-gray-400">LEO cap: <span className="text-white">{d.x.toLocaleString()} kg</span></div>
      <div className="text-gray-400">~Apogee: <span className="text-white">{d.y.toLocaleString()} km</span></div>
      <div className={`mt-1 font-bold ${d.status === 'Success' ? 'text-green-400' : d.status === 'Failure' ? 'text-red-400' : 'text-gray-400'}`}>
        {d.status}
      </div>
    </div>
  )
}

export default function PayloadScatterPlot({ launches, onPointClick, fetchedAt }) {
  const [hiddenAgencies, setHiddenAgencies] = useState(new Set())

  const { scatterGroups, agencies } = useMemo(() => {
    const valid = (launches || []).filter(l =>
      l.rocket?.configuration?.leo_capacity != null &&
      l.mission?.orbit?.abbrev &&
      ORBIT_APOGEE[l.mission.orbit.abbrev] != null
    )

    const agencyMap = {}
    valid.forEach(l => {
      const agency = l.launch_service_provider?.name || 'Unknown'
      if (!agencyMap[agency]) agencyMap[agency] = []
      agencyMap[agency].push({
        x: l.rocket.configuration.leo_capacity,
        y: ORBIT_APOGEE[l.mission.orbit.abbrev],
        name: l.name,
        orbit: l.mission.orbit.abbrev,
        agency,
        id: l.id,
        status: l.status?.abbrev,
      })
    })

    return {
      scatterGroups: Object.entries(agencyMap),
      agencies: Object.keys(agencyMap),
    }
  }, [launches])

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
        <span className="text-[10px] font-mono text-accent tracking-widest uppercase">Payload vs Orbit</span>
        <span className="text-[10px] font-mono text-gray-500">— LEO capacity × orbit altitude</span>
        <DataSourceTag source="LL2 v2.2.0 rocket config" fetchedAt={fetchedAt} />
      </div>

      {/* Shape legend */}
      <div className="flex flex-wrap gap-3 mb-3 text-[9px] font-mono text-gray-500">
        <span>● LEO/SSO/MEO</span>
        <span>■ GEO/GTO</span>
        <span>▲ HEO/TLI/BEO</span>
      </div>

      {/* Agency filter chips */}
      {agencies.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {agencies.map(a => (
            <button
              key={a}
              type="button"
              onClick={() => toggleAgency(a)}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded border transition-all"
              style={{
                borderColor: agencyColor(a) + '80',
                color: hiddenAgencies.has(a) ? '#4B5563' : agencyColor(a),
                background: hiddenAgencies.has(a) ? 'transparent' : agencyColor(a) + '15',
                textDecoration: hiddenAgencies.has(a) ? 'line-through' : 'none',
              }}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {scatterGroups.length === 0 && (
        <div className="py-12 text-center text-gray-500 font-mono text-sm">
          No launches with payload + orbit data in current filter set.
        </div>
      )}

      {scatterGroups.length > 0 && (
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(27,108,168,0.15)" />
            <XAxis
              type="number"
              dataKey="x"
              name="LEO Capacity"
              unit=" kg"
              tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
              tick={{ fill: '#9CA3AF', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(27,108,168,0.3)' }}
              label={{ value: 'LEO Capacity (kg)', fill: '#4B5563', fontSize: 9, position: 'insideBottomRight', offset: -10 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Orbit Altitude"
              unit=" km"
              scale="log"
              domain={['auto', 'auto']}
              tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
              tick={{ fill: '#9CA3AF', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(27,108,168,0.3)' }}
              width={38}
              label={{ value: 'Apogee (km)', fill: '#4B5563', fontSize: 9, angle: -90, position: 'insideLeft' }}
            />
            <ZAxis range={[40, 40]} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(27,108,168,0.4)', strokeWidth: 1 }} />
            {scatterGroups.map(([agency, data]) => (
              !hiddenAgencies.has(agency) && (
                <Scatter
                  key={agency}
                  name={agency}
                  data={data}
                  fill={agencyColor(agency)}
                  shape={<CustomDot />}
                  onClick={point => onPointClick && onPointClick(point.id)}
                />
              )
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
