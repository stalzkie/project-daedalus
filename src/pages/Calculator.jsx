import { useState, useCallback } from 'react'
import NavBar from '../components/shared/NavBar'
import LoadFromDatabase from '../components/calculator/LoadFromDatabase'
import ExportReport from '../components/calculator/ExportReport'
import FormulaReferencePanel from '../components/calculator/FormulaReferencePanel'
import PropulsionTab from '../components/calculator/tabs/PropulsionTab'
import OrbitalTab from '../components/calculator/tabs/OrbitalTab'
import TrajectoryTab from '../components/calculator/tabs/TrajectoryTab'
import ReentryTab from '../components/calculator/tabs/ReentryTab'
import SimulatorTab from '../components/calculator/tabs/SimulatorTab'

const TABS = [
  { id: 'propulsion',  label: 'Propulsion'        },
  { id: 'orbital',     label: 'Orbital Mechanics'  },
  { id: 'trajectory',  label: 'Trajectory'         },
  { id: 'reentry',     label: 'Reentry'            },
  { id: 'simulator',   label: 'Simulator'          },
]

// Map LL2 vehicle fields to formula input keys
function vehicleToInputs(vehicle) {
  return {
    tsiolkovsky:     { m0_kg: vehicle.totalMass_kg },
    thrust:          { massFlowRate_kgs: vehicle.thrust_N != null ? vehicle.thrust_N / (350 * 9.80665) : undefined },
    twr:             { thrust_N: vehicle.thrust_N, totalMass_kg: vehicle.totalMass_kg },
    hohmann:         {},
    'dynamic-pressure': {},
  }
}

// Known stage specs for common rockets — keyed by family name substring.
// Covers ~80% of searches; anything else falls back to generic estimation.
const KNOWN_STAGES = {
  'Falcon 9': [
    { dryMass_kg: 22200, propMass_kg: 411000, isp_vac_s: 311, isp_sl_s: 282, thrust_N: 7607000 },
    { dryMass_kg:  4000, propMass_kg:  92670, isp_vac_s: 348, isp_sl_s: 348, thrust_N:  934000 },
  ],
  'Falcon Heavy': [
    { dryMass_kg: 66400, propMass_kg: 1233000, isp_vac_s: 311, isp_sl_s: 282, thrust_N: 22819000 },
    { dryMass_kg:  4000, propMass_kg:   92670, isp_vac_s: 348, isp_sl_s: 348, thrust_N:   934000 },
  ],
  'Atlas V': [
    { dryMass_kg: 21054, propMass_kg: 284089, isp_vac_s: 338, isp_sl_s: 311, thrust_N: 4152000 },
    { dryMass_kg:  2316, propMass_kg:  20830, isp_vac_s: 451, isp_sl_s: 451, thrust_N:   99200 },
  ],
  'Ariane 5': [
    { dryMass_kg: 14700, propMass_kg: 158000, isp_vac_s: 431, isp_sl_s: 311, thrust_N: 1340000 },
    { dryMass_kg:  4540, propMass_kg:  14900, isp_vac_s: 446, isp_sl_s: 446, thrust_N:   67000 },
  ],
  'Ariane 6': [
    { dryMass_kg: 17200, propMass_kg: 168000, isp_vac_s: 433, isp_sl_s: 315, thrust_N: 1370000 },
    { dryMass_kg:  3500, propMass_kg:  28000, isp_vac_s: 458, isp_sl_s: 458, thrust_N:   180000 },
  ],
  'Soyuz': [
    { dryMass_kg:  6500, propMass_kg: 267900, isp_vac_s: 310, isp_sl_s: 256, thrust_N: 4100000 },
    { dryMass_kg:  2355, propMass_kg:  22700, isp_vac_s: 330, isp_sl_s: 330, thrust_N:  297400 },
  ],
  'Long March 2': [
    { dryMass_kg: 11000, propMass_kg: 168000, isp_vac_s: 289, isp_sl_s: 260, thrust_N: 2961600 },
    { dryMass_kg:  3900, propMass_kg:  54900, isp_vac_s: 300, isp_sl_s: 300, thrust_N:  720000 },
  ],
  'Long March 5': [
    { dryMass_kg: 15000, propMass_kg: 170000, isp_vac_s: 430, isp_sl_s: 311, thrust_N: 2400000 },
    { dryMass_kg:  4500, propMass_kg:  66000, isp_vac_s: 438, isp_sl_s: 438, thrust_N:   176500 },
  ],
  'Electron': [
    { dryMass_kg:  950, propMass_kg: 9250, isp_vac_s: 311, isp_sl_s: 303, thrust_N: 162000 },
    { dryMass_kg:  250, propMass_kg: 2050, isp_vac_s: 333, isp_sl_s: 333, thrust_N:  22000 },
  ],
  'Vulcan': [
    { dryMass_kg: 21000, propMass_kg: 461000, isp_vac_s: 363, isp_sl_s: 320, thrust_N: 4870000 },
    { dryMass_kg:  3500, propMass_kg:  30000, isp_vac_s: 462, isp_sl_s: 462, thrust_N:  110000 },
  ],
  'New Glenn': [
    { dryMass_kg: 40000, propMass_kg: 983000, isp_vac_s: 374, isp_sl_s: 316, thrust_N: 7100000 },
    { dryMass_kg:  9000, propMass_kg: 196000, isp_vac_s: 440, isp_sl_s: 440, thrust_N:  710000 },
  ],
  'Starship': [
    { dryMass_kg: 200000, propMass_kg: 3400000, isp_vac_s: 350, isp_sl_s: 330, thrust_N: 74000000 },
    { dryMass_kg: 100000, propMass_kg: 1200000, isp_vac_s: 380, isp_sl_s: 380, thrust_N: 14700000 },
  ],
}

// Build stage array from a selected LL2 vehicle record.
// Uses known-data lookup first; falls back to generic mass-fraction estimation.
function vehicleToStages(vehicle) {
  const match = Object.keys(KNOWN_STAGES).find(k =>
    (vehicle.family || '').includes(k) ||
    (vehicle.name   || '').includes(k)
  )
  if (match) return KNOWN_STAGES[match].map(s => ({ ...s }))

  // Generic fallback: split totalMass across stages using typical mass fractions
  const total   = vehicle.totalMass_kg ?? 300000
  const count   = Math.max(1, Math.min(3, vehicle.stages ?? 2))
  const thrust  = vehicle.thrust_N ?? total * 15   // ~15 N/kg → TWR ≈ 1.5

  if (count === 1) {
    return [{ dryMass_kg: Math.round(total * 0.07), propMass_kg: Math.round(total * 0.93),
              isp_vac_s: 315, isp_sl_s: 285, thrust_N: thrust }]
  }
  const s1 = Math.round(total * 0.80)
  const s2 = Math.round(total * 0.16)
  const stages = [
    { dryMass_kg: Math.round(s1 * 0.06), propMass_kg: Math.round(s1 * 0.94),
      isp_vac_s: 315, isp_sl_s: 285, thrust_N: thrust },
    { dryMass_kg: Math.round(s2 * 0.08), propMass_kg: Math.round(s2 * 0.92),
      isp_vac_s: 342, isp_sl_s: 342, thrust_N: Math.round(thrust * 0.12) },
  ]
  if (count >= 3) stages.push(
    { dryMass_kg: 800, propMass_kg: 8000, isp_vac_s: 450, isp_sl_s: 450, thrust_N: Math.round(thrust * 0.02) }
  )
  return stages
}

export default function Calculator() {
  const [activeTab,    setActiveTab]    = useState('propulsion')
  const [results,         setResults]         = useState([])
  const [dbUsed,          setDbUsed]          = useState(false)
  const [prefill,         setPrefill]         = useState({})    // formula tab inputs
  const [simulatorStages, setSimulatorStages] = useState(null)  // null = use simulator defaults

  const handleResult = useCallback((formulaId, result, inputValues) => {
    setResults(prev => {
      const without = prev.filter(r => r.id !== formulaId)
      return [...without, {
        id: formulaId,
        name: result.name ?? formulaId,
        description: result.description ?? '',
        inputs: inputValues ? Object.entries(inputValues).map(([k, v]) => ({ label: k, value: v, unit: '' })) : [],
        resultValue:  result[Object.keys(result).find(k => k.endsWith('_ms') || k.endsWith('_N') || k.endsWith('_s') || k.endsWith('_Pa') || k === 'twr' || k === 'beta_kgm2' || k === 'peakDecel_g')] ?? null,
        resultLabel:  '',
        resultUnit:   '',
        working:      result.working ?? [],
      }]
    })
  }, [])

  const handleDbSelect = useCallback((vehicle) => {
    setPrefill(vehicleToInputs(vehicle))
    setSimulatorStages(vehicleToStages(vehicle))
    setDbUsed(true)
    setActiveTab('simulator')   // jump straight to simulator when loading a vehicle
  }, [])

  const handleNavigate = useCallback((tab, formulaId) => {
    setActiveTab(tab)
  }, [])

  const TabContent = {
    propulsion:  <PropulsionTab  onResult={handleResult} prefill={prefill} />,
    orbital:     <OrbitalTab    onResult={handleResult} prefill={prefill} />,
    trajectory:  <TrajectoryTab onResult={handleResult} prefill={prefill} />,
    reentry:     <ReentryTab    onResult={handleResult} prefill={prefill} />,
    simulator:   <SimulatorTab prefillStages={simulatorStages} />,
  }[activeTab]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0B1F4B' }}>
      <NavBar />

      {/* Sub-header */}
      <div className="border-b border-accent/20 px-4 py-1.5 flex items-center gap-3">
        <span className="text-[11px] font-mono text-gray-500">
          MODULE 3 · MISSION CALCULATOR & SIMULATOR
        </span>
        <span className="text-[10px] font-mono text-gray-600 hidden sm:block">
          · KaTeX formulas · Euler integration · jsPDF export
        </span>
      </div>

      <main className="flex-1 p-4 max-w-screen-xl mx-auto w-full space-y-4 pr-10">
        {/* DB loader */}
        <LoadFromDatabase onSelect={handleDbSelect} activeTab={activeTab} />

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-accent/20 pb-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-[11px] font-mono rounded-t border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'text-accent border-accent bg-accent/10'
                  : 'text-gray-400 border-transparent hover:text-white hover:border-accent/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>{TabContent}</div>

        {/* Export */}
        <ExportReport results={results} dbUsed={dbUsed} />
      </main>

      {/* Formula reference panel (right slide-in) */}
      <FormulaReferencePanel onNavigate={handleNavigate} />

      <footer className="border-t border-accent/20 px-4 py-2 flex items-center justify-between
        text-[9px] font-mono text-gray-600 shrink-0">
        <span>PROJECT DAEDALUS · MODULE 3 · MISSION CALCULATOR</span>
        <span>Formulas: SI units · Constants: CODATA 2018 · Atmosphere: ISA</span>
      </footer>
    </div>
  )
}
