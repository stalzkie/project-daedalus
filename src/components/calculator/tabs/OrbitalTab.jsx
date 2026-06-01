import FormulaCard from '../FormulaCard'
import { FORMULAS_BY_TAB } from '../../../lib/formulaConfig'

const configs = FORMULAS_BY_TAB['orbital'] || []

// Group: single-input cards side-by-side, Hohmann full width
export default function OrbitalTab({ onResult, prefill }) {
  const single = configs.filter(c => c.inputs.length <= 1)
  const multi  = configs.filter(c => c.inputs.length > 1)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {single.map(cfg => (
          <FormulaCard key={cfg.id} config={cfg} prefillValues={prefill?.[cfg.id]} onResult={onResult} />
        ))}
      </div>
      {multi.map(cfg => (
        <FormulaCard key={cfg.id} config={cfg} prefillValues={prefill?.[cfg.id]} onResult={onResult} />
      ))}
    </div>
  )
}
