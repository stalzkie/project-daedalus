import { useMemo } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer, Label,
} from 'recharts'
import { simulateAscent } from '../../lib/rocketFormulas'

const EVENT_COLORS = {
  max_q:      '#B45309',
  staging:    '#1B6CA8',
  fairing_sep:'#1A7F4B',
}
const EVENT_LABELS = {
  max_q:      'Max-Q',
  staging:    'Stage Sep',
  fairing_sep:'Fairing Sep',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-navy-800 border border-accent/40 rounded p-2 text-[10px] font-mono shadow-xl"
         style={{ background: '#0d2257' }}>
      <div className="text-accent font-bold mb-1">T+{label}s</div>
      <div className="text-blue-300">Altitude: {d.h} km</div>
      <div className="text-green-300">Velocity: {d.v?.toLocaleString()} m/s</div>
      {d.q != null && <div className="text-orange-300">Dyn. pressure: {(d.q / 1000).toFixed(1)} kPa</div>}
      {d.m != null && <div className="text-gray-400">Mass: {d.m?.toLocaleString()} kg</div>}
    </div>
  )
}

export default function TrajectoryChart({ stages, options }) {
  const sim = useMemo(() => {
    if (!stages?.length) return null
    return simulateAscent(stages, options)
  }, [stages, options])

  if (!stages?.length) {
    return (
      <div className="panel p-4 flex items-center justify-center text-gray-500 font-mono text-sm" style={{ minHeight: 260 }}>
        Add at least one stage to view trajectory simulation.
      </div>
    )
  }

  if (!sim?.data?.length) {
    return (
      <div className="panel p-4 flex items-center justify-center text-yellow-400 font-mono text-sm" style={{ minHeight: 260 }}>
        Simulation produced no data — check stage parameters (TWR &gt; 1 required for liftoff).
      </div>
    )
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[10px] font-mono text-accent tracking-widest uppercase">Ascent Trajectory</span>
        <span className="text-[10px] font-mono text-gray-500">— Euler integration, 1 s timestep</span>
        {sim.maxQAlt_km > 0 && (
          <span className="text-[10px] font-mono text-orange-400 ml-auto">
            Max-Q: {(sim.maxQ_Pa / 1000).toFixed(1)} kPa @ {sim.maxQAlt_km.toFixed(1)} km
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={sim.data} margin={{ top: 5, right: 50, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(27,108,168,0.12)" />

          <XAxis
            dataKey="t"
            tick={{ fill: '#9CA3AF', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(27,108,168,0.3)' }}
          >
            <Label value="Time (s)" position="insideBottom" offset={-10}
              style={{ fill: '#4B5563', fontSize: 9, fontFamily: 'monospace' }} />
          </XAxis>

          {/* Left Y: altitude */}
          <YAxis
            yAxisId="alt"
            dataKey="h"
            tick={{ fill: '#60A5FA', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={false}
            width={42}
          >
            <Label value="Alt (km)" angle={-90} position="insideLeft"
              style={{ fill: '#60A5FA', fontSize: 9, fontFamily: 'monospace' }} />
          </YAxis>

          {/* Right Y: velocity */}
          <YAxis
            yAxisId="vel"
            orientation="right"
            dataKey="v"
            tick={{ fill: '#34D399', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={false}
            width={52}
          >
            <Label value="Vel (m/s)" angle={90} position="insideRight"
              style={{ fill: '#34D399', fontSize: 9, fontFamily: 'monospace' }} />
          </YAxis>

          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#9CA3AF', paddingTop: 8 }}
          />

          {/* Event reference lines */}
          {sim.events.map((ev, i) => (
            <ReferenceLine
              key={i}
              x={ev.t}
              yAxisId="alt"
              stroke={EVENT_COLORS[ev.type] || '#6B7280'}
              strokeDasharray="4 2"
              label={{
                value: ev.label || EVENT_LABELS[ev.type] || ev.type,
                fill: EVENT_COLORS[ev.type] || '#6B7280',
                fontSize: 9,
                fontFamily: 'JetBrains Mono, monospace',
                position: 'top',
              }}
            />
          ))}

          <Line
            yAxisId="alt"
            type="monotone"
            dataKey="h"
            stroke="#1B6CA8"
            strokeWidth={2}
            dot={false}
            name="Altitude (km)"
            isAnimationActive={false}
          />
          <Line
            yAxisId="vel"
            type="monotone"
            dataKey="v"
            stroke="#1A7F4B"
            strokeWidth={2}
            dot={false}
            name="Velocity (m/s)"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mt-3 text-[10px] font-mono">
        <StatCell label="Max altitude" value={`${Math.max(...sim.data.map(d => d.h)).toFixed(0)} km`} />
        <StatCell label="Max velocity" value={`${Math.max(...sim.data.map(d => d.v)).toLocaleString()} m/s`} />
        <StatCell label="MECO time"    value={`T+${sim.mecoTime_s}s`} />
      </div>
    </div>
  )
}

function StatCell({ label, value }) {
  return (
    <div className="bg-black/20 border border-accent/10 rounded px-2 py-1.5">
      <div className="text-gray-500 text-[8px] uppercase tracking-widest">{label}</div>
      <div className="text-white font-semibold mt-0.5">{value}</div>
    </div>
  )
}
