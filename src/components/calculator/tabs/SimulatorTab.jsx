import { useState } from 'react'
import MultiStageSimulator from '../MultiStageSimulator'
import TrajectoryChart from '../TrajectoryChart'

export default function SimulatorTab({ prefillStages }) {
  const [stages, setStages] = useState(null)
  const [simOptions] = useState({
    Cd:              0.3,
    referenceArea_m2: 12,
    fairingMass_kg:   1900,
    fairingSepAlt_m:  110_000,
    dt:               1,
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left: stage inputs + summary */}
      <div>
        <div className="text-[10px] font-mono text-accent uppercase tracking-widest mb-3 px-1">
          Stage Configuration
        </div>
        <MultiStageSimulator onStagesChange={setStages} prefillStages={prefillStages} />
      </div>

      {/* Right: trajectory chart */}
      <div>
        <div className="text-[10px] font-mono text-accent uppercase tracking-widest mb-3 px-1">
          Ascent Trajectory Simulation
        </div>
        <TrajectoryChart stages={stages} options={simOptions} />

        {/* Sim assumptions note */}
        <div className="mt-3 panel p-3 text-[9px] font-mono text-gray-600 space-y-1">
          <div className="text-gray-500 font-semibold mb-1">Simulation Assumptions</div>
          <div>· Vertical ascent only (no gravity-turn or pitch program)</div>
          <div>· Isp linearly interpolated from SL → vacuum over 0–25 km</div>
          <div>· Atmosphere: ISA simplified · Scale height H = 8 500 m</div>
          <div>· Drag: Cd = {simOptions.Cd}, ref. area = {simOptions.referenceArea_m2} m²</div>
          <div>· Fairing mass ({simOptions.fairingMass_kg.toLocaleString()} kg) jettisoned at {(simOptions.fairingSepAlt_m/1000).toFixed(0)} km</div>
          <div>· Forward Euler, dt = {simOptions.dt} s — suitable for visualisation only</div>
        </div>
      </div>
    </div>
  )
}
