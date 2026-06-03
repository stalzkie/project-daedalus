import { useState } from 'react'
import FormulaCard from '../FormulaCard'
import { FORMULAS_BY_TAB } from '../../../lib/formulaConfig'
import { dynamicPressure, atmosphericDensity } from '../../../lib/rocketFormulas'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

const configs = FORMULAS_BY_TAB['trajectory'] || []

// Density vs altitude chart (0–80 km)
const densityData = Array.from({ length: 81 }, (_, i) => ({
  h: i,
  rho: parseFloat(atmosphericDensity(i * 1000).toExponential(3)),
}))

export default function TrajectoryTab({ onResult, prefill }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {configs.map(cfg => (
          <FormulaCard key={cfg.id} config={cfg} prefillValues={prefill?.[cfg.id]} onResult={onResult} />
        ))}

        {/* Atmospheric density quick-reference chart */}
        <div className="panel p-4">
          <div className="text-[10px] font-mono text-accent uppercase tracking-widest mb-3">
            Atmospheric Density Profile (ISA)
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={densityData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(27,108,168,0.12)" />
              <XAxis dataKey="h" tick={{ fill: '#64748B', fontSize: 9 }}
                label={{ value: 'Altitude (km)', position: 'insideBottom', offset: -4, fill: '#4B5563', fontSize: 8 }} />
              <YAxis tick={{ fill: '#64748B', fontSize: 9 }} width={55}
                tickFormatter={v => v.toExponential(1)}
                label={{ value: 'ρ (kg/m³)', angle: -90, position: 'insideLeft', fill: '#4B5563', fontSize: 8 }} />
              <Tooltip
                formatter={v => [`${v} kg/m³`, 'Density']}
                contentStyle={{ background: '#FFFFFF', border: '1px solid rgba(27,108,168,0.2)', fontSize: 10 }}
              />
              <ReferenceLine x={11} stroke="#B45309" strokeDasharray="3 2"
                label={{ value: 'Tropopause 11km', fill: '#B45309', fontSize: 8 }} />
              <ReferenceLine x={25} stroke="#7C3AED" strokeDasharray="3 2"
                label={{ value: 'Stratosphere 25km', fill: '#7C3AED', fontSize: 8 }} />
              <Line type="monotone" dataKey="rho" stroke="#1B6CA8" strokeWidth={2} dot={false}
                isAnimationActive={false} name="Density" />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-2 text-[9px] font-mono text-gray-600 text-center">
            Scale height H ≈ 8 500 m · ρ₀ = 1.225 kg/m³
          </div>
        </div>
      </div>
    </div>
  )
}
