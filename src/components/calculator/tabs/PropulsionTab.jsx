import { useRef } from 'react'
import FormulaCard from '../FormulaCard'
import { FORMULAS_BY_TAB } from '../../../lib/formulaConfig'

const configs = FORMULAS_BY_TAB['propulsion'] || []

export default function PropulsionTab({ onResult, prefill }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {configs.map(cfg => (
          <FormulaCard
            key={cfg.id}
            config={cfg}
            prefillValues={prefill?.[cfg.id]}
            onResult={onResult}
          />
        ))}
      </div>
    </div>
  )
}
