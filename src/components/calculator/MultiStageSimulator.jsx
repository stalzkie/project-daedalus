import { useState, useMemo, useEffect } from 'react'
import { multiStageSimulator } from '../../lib/rocketFormulas'
import WorkingSteps from './WorkingSteps'

const g0 = 9.80665

const ORBITS = [
  { id: 'LEO',    label: 'LEO',       dv: 9400,  desc: 'Low Earth Orbit'            },
  { id: 'SSO',    label: 'SSO',       dv: 9700,  desc: 'Sun-Synchronous Orbit'      },
  { id: 'MEO',    label: 'MEO',       dv: 10800, desc: 'Medium Earth Orbit (GPS)'   },
  { id: 'GTO',    label: 'GTO',       dv: 10950, desc: 'Geostationary Transfer'     },
  { id: 'GEO',    label: 'GEO',       dv: 12000, desc: 'Geostationary Orbit'        },
  { id: 'TLI',    label: 'Moon (TLI)',dv: 13500, desc: 'Trans-Lunar Injection'      },
  { id: 'TMI',    label: 'Mars (TMI)',dv: 15700, desc: 'Trans-Mars Injection'       },
  { id: 'ESC',    label: 'Escape',    dv: 14000, desc: 'Solar System Escape'        },
]

const DEFAULT_STAGE = {
  dryMass_kg: 25600,
  propMass_kg: 418800,
  isp_vac_s:   348,
  isp_sl_s:    282,
  thrust_N:    7607000,
}

function TwrBar({ twr }) {
  const pct  = Math.min(100, (twr / 3) * 100)
  const color = twr >= 1.3 ? 'bg-green-500' : twr >= 1.0 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono">
      <span className="text-gray-500 w-8">TWR</span>
      <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={twr >= 1.0 ? 'text-green-600' : 'text-red-600'}>{twr.toFixed(2)}</span>
    </div>
  )
}

function DvBar({ dv, totalDv }) {
  const pct = totalDv > 0 ? (dv / totalDv) * 100 : 0
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono">
      <span className="text-gray-500 w-8">Δv</span>
      <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[#1A1F36] w-20 text-right">{dv.toFixed(0)} m/s</span>
    </div>
  )
}

export default function MultiStageSimulator({ onStagesChange, prefillStages }) {
  const [stages, setStages]          = useState([{ ...DEFAULT_STAGE }])
  const [showWorking, setShowWorking] = useState(false)
  const [targetOrbitId, setTargetOrbitId] = useState('LEO')
  const targetOrbit = ORBITS.find(o => o.id === targetOrbitId) ?? ORBITS[0]

  // When a vehicle is selected from the database, replace the stage configuration
  useEffect(() => {
    if (!prefillStages?.length) return
    setStages(prefillStages)
    onStagesChange?.(prefillStages)
  }, [prefillStages])

  function addStage() {
    if (stages.length >= 4) return
    const next = [...stages, {
      dryMass_kg:  4000,
      propMass_kg: 92000,
      isp_vac_s:   348,
      isp_sl_s:    348,
      thrust_N:    934000,
    }]
    setStages(next)
    onStagesChange?.(next)
  }

  function removeStage(i) {
    const next = stages.filter((_, idx) => idx !== i)
    setStages(next)
    onStagesChange?.(next)
  }

  function updateField(stageIdx, field, val) {
    const next = stages.map((s, i) =>
      i === stageIdx ? { ...s, [field]: parseFloat(val) || 0 } : s
    )
    setStages(next)
    onStagesChange?.(next)
  }

  const sim = useMemo(() => multiStageSimulator(stages), [stages])

  const canReach = sim.totalDeltaV_ms >= targetOrbit.dv

  const cumulative = sim.stageDeltaVs.reduce((acc, dv, i) => {
    acc.push((acc[i - 1] ?? 0) + dv)
    return acc
  }, [])

  return (
    <div className="space-y-4">
      {/* Stage cards */}
      {stages.map((stage, i) => {
        const stageDv  = sim.stageDeltaVs[i] ?? 0
        const stageTwr = sim.twrPerStage?.[i] ?? 0
        return (
          <div key={i} className="panel p-4 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono text-accent uppercase tracking-widest">
                Stage {i + 1}
              </span>
              {stages.length > 1 && (
                <button type="button" onClick={() => removeStage(i)}
                  className="text-gray-600 hover:text-red-400 text-[10px] font-mono transition-colors">
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              {[
                { field: 'dryMass_kg',  label: 'Dry Mass',      unit: 'kg',  step: 100  },
                { field: 'propMass_kg', label: 'Propellant Mass',unit: 'kg',  step: 1000 },
                { field: 'isp_vac_s',   label: 'Isp (vacuum)',   unit: 's',   step: 1    },
                { field: 'isp_sl_s',    label: 'Isp (sea level)',unit: 's',   step: 1    },
                { field: 'thrust_N',    label: 'Thrust',         unit: 'N',   step: 1000 },
              ].map(({ field, label, unit, step }) => (
                <div key={field}>
                  <label className="text-[8px] font-mono text-gray-500 uppercase tracking-widest block mb-0.5">
                    {label}
                  </label>
                  <div className="flex">
                    <input
                      type="number"
                      step={step}
                      value={stage[field]}
                      onChange={e => updateField(i, field, e.target.value)}
                      className="flex-1 min-w-0 bg-white border border-accent/30 hover:border-accent/50
                        rounded-l px-2 py-1 text-[11px] font-mono text-[#1A1F36] focus:outline-none focus:border-accent"
                    />
                    <span className="bg-accent/15 border border-l-0 border-accent/30 rounded-r px-1.5
                      text-[9px] font-mono text-accent flex items-center whitespace-nowrap">
                      {unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Per-stage metrics */}
            <div className="space-y-1.5 pt-2 border-t border-accent/10">
              <TwrBar twr={stageTwr} />
              <DvBar  dv={stageDv} totalDv={sim.totalDeltaV_ms} />
            </div>
          </div>
        )
      })}

      {/* Add stage button */}
      {stages.length < 4 && (
        <button type="button" onClick={addStage}
          className="w-full py-2 border border-dashed border-accent/30 rounded text-[11px] font-mono
            text-gray-500 hover:text-accent hover:border-accent/60 transition-colors">
          + Add Stage {stages.length + 1}
        </button>
      )}

      {/* Summary */}
      <div className={`panel p-4 border-2 ${canReach ? 'border-green-600/50' : 'border-red-700/50'}`}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="text-[10px] font-mono text-accent uppercase tracking-widest">Mission Summary</span>
          <span className={`font-mono text-sm font-bold px-3 py-1 rounded border ${
            canReach
              ? 'text-green-700 border-green-400 bg-green-50'
              : 'text-red-700 border-red-400 bg-red-50'
          }`}>
            {canReach ? `✓ CAN REACH ${targetOrbit.label}` : `✗ CANNOT REACH ${targetOrbit.label}`}
          </span>
        </div>

        {/* Target orbit selector */}
        <div className="flex flex-wrap gap-1 mb-3">
          {ORBITS.map(o => (
            <button
              key={o.id}
              type="button"
              title={`${o.desc} — Δv ≥ ${o.dv.toLocaleString()} m/s`}
              onClick={() => setTargetOrbitId(o.id)}
              className="text-[9px] font-mono px-2 py-0.5 rounded border transition-all"
              style={targetOrbitId === o.id
                ? { background: 'rgba(27,108,168,0.12)', color: '#1B6CA8', borderColor: 'rgba(27,108,168,0.6)' }
                : { background: 'transparent', color: '#6B7280', borderColor: 'rgba(27,108,168,0.2)' }
              }
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* ΔV progress bar toward target orbit */}
        <div className="mb-3">
          <div className="flex justify-between text-[9px] font-mono text-gray-500 mb-1">
            <span>Total Δv</span>
            <span>{targetOrbit.desc}: ≥ {targetOrbit.dv.toLocaleString()} m/s</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${canReach ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, (sim.totalDeltaV_ms / targetOrbit.dv) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono mt-1">
            <span className={canReach ? 'text-green-600' : 'text-red-600'}>
              {sim.totalDeltaV_ms.toFixed(0)} m/s
            </span>
            <span className="text-gray-500">{(sim.totalDeltaV_ms / targetOrbit.dv * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Per-stage breakdown */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {stages.map((_, i) => (
            <div key={i} className="text-[10px] font-mono">
              <span className="text-gray-500">Stage {i + 1}: </span>
              <span className="text-[#1A1F36]">{(sim.stageDeltaVs[i] ?? 0).toFixed(0)} m/s</span>
              <span className="text-gray-600"> (cum. {(cumulative[i] ?? 0).toFixed(0)} m/s)</span>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-mono">
          <div className="bg-[#F8FAFC] border border-accent/10 rounded p-2">
            <div className="text-gray-500 text-[8px] uppercase">Launch Mass</div>
            <div className="text-[#1A1F36]">{(sim.massAtEachStage?.[0] ?? 0).toLocaleString()} kg</div>
          </div>
          <div className="bg-[#F8FAFC] border border-accent/10 rounded p-2">
            <div className="text-gray-500 text-[8px] uppercase">Payload Mass</div>
            <div className="text-[#1A1F36]">
              {(sim.massAtEachStage?.[stages.length] ?? 0).toLocaleString()} kg
            </div>
          </div>
          <div className="bg-[#F8FAFC] border border-accent/10 rounded p-2">
            <div className="text-gray-500 text-[8px] uppercase">Mass fraction</div>
            <div className="text-[#1A1F36]">
              {sim.massAtEachStage?.[0] > 0
                ? ((sim.massAtEachStage[stages.length] / sim.massAtEachStage[0]) * 100).toFixed(2)
                : '—'}%
            </div>
          </div>
        </div>

        <button type="button" onClick={() => setShowWorking(s => !s)}
          className="mt-3 text-[10px] font-mono text-gray-500 hover:text-accent transition-colors">
          {showWorking ? '▲ Hide working' : '▼ Show working'}
        </button>
        {showWorking && <WorkingSteps steps={sim.working} />}
      </div>
    </div>
  )
}
