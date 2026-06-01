import FormulaCard from '../FormulaCard'
import { FORMULAS_BY_TAB } from '../../../lib/formulaConfig'

const configs = FORMULAS_BY_TAB['reentry'] || []

// Reentry regime reference table
const REGIMES = [
  { vehicle: 'Apollo capsule',    v: 11000, angle: 6.5, beta: 380,  decel: '12–14 g' },
  { vehicle: 'Soyuz descent module', v: 7800, angle: 3.3, beta: 300, decel: '3–4 g' },
  { vehicle: 'Space Shuttle',     v: 7850,  angle: 1.2, beta: 130,  decel: '1.5 g'  },
  { vehicle: 'Dragon capsule',    v: 7800,  angle: 6.0, beta: 420,  decel: '4–5 g'  },
  { vehicle: 'Starliner',         v: 7800,  angle: 5.5, beta: 380,  decel: '3–4 g'  },
]

export default function ReentryTab({ onResult, prefill }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {configs.map(cfg => (
          <FormulaCard key={cfg.id} config={cfg} prefillValues={prefill?.[cfg.id]} onResult={onResult} />
        ))}
      </div>

      {/* Reentry regimes reference */}
      <div className="panel p-4">
        <div className="text-[10px] font-mono text-accent uppercase tracking-widest mb-3">
          Reentry Regime Reference
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="border-b border-accent/20">
                {['Vehicle', 'v_entry (m/s)', 'γ (°)', 'β (kg/m²)', 'Peak decel'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-[9px] text-gray-500 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {REGIMES.map((r, i) => (
                <tr key={i} className="border-b border-accent/10 hover:bg-white/5">
                  <td className="px-2 py-1.5 text-white">{r.vehicle}</td>
                  <td className="px-2 py-1.5 text-gray-300">{r.v.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-gray-300">{r.angle}</td>
                  <td className="px-2 py-1.5 text-gray-300">{r.beta}</td>
                  <td className={`px-2 py-1.5 ${parseFloat(r.decel) < 5 ? 'text-green-400' : parseFloat(r.decel) < 10 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {r.decel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-[9px] font-mono text-gray-600">
          Values are approximate. Actual deceleration depends on atmospheric conditions, vehicle orientation, and trajectory.
        </div>
      </div>
    </div>
  )
}
