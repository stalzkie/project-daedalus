/**
 * Renders the numbered working-steps array returned by every formula function.
 * Each step: { description, formula, value, unit }
 */
export default function WorkingSteps({ steps }) {
  if (!steps || steps.length === 0) return null
  return (
    <div className="mt-4 border-t border-accent/20 pt-3 space-y-1.5">
      <div className="text-[9px] font-mono text-accent uppercase tracking-widest mb-2">Working</div>
      {steps.map((s, i) => {
        const val = typeof s.value === 'number'
          ? (Math.abs(s.value) >= 1000 ? s.value.toLocaleString(undefined, { maximumFractionDigits: 3 })
             : s.value.toFixed(4).replace(/\.?0+$/, ''))
          : s.value
        return (
          <div key={i} className="flex gap-2 items-start text-[11px]">
            <span className="text-gray-600 font-mono shrink-0 w-5 text-right">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <span className="text-gray-400">{s.description}</span>
              {s.formula && (
                <span className="ml-1 font-mono text-gray-500 text-[10px]">({s.formula})</span>
              )}
            </div>
            <div className="font-mono text-white shrink-0 text-right">
              {val}
              {s.unit && s.unit !== '—' && (
                <span className="text-accent ml-1 text-[9px]">{s.unit}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
