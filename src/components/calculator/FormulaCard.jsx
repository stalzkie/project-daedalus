import { useState, useMemo, useEffect, useImperativeHandle, forwardRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import WorkingSteps from './WorkingSteps'

const RESULT_COLOR = {
  green:   'text-green-400',
  yellow:  'text-yellow-400',
  danger:  'text-red-400',
  neutral: 'text-white',
}

function KatexFormula({ latex }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, { throwOnError: false, displayMode: true })
    } catch {
      return `<span class="text-red-400 font-mono text-xs">${latex}</span>`
    }
  }, [latex])
  return (
    <div
      className="katex-dark text-center py-2 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

const FormulaCard = forwardRef(function FormulaCard(
  { config, prefillValues, onResult, compact = false },
  ref
) {
  const [values, setValues]   = useState(() =>
    Object.fromEntries(config.inputs.map(i => [i.key, i.default ?? '']))
  )
  const [errors, setErrors]   = useState({})
  const [result, setResult]   = useState(null)
  const [expanded, setExpanded] = useState(false)

  // Allow parent to pre-fill values (e.g. from LoadFromDatabase)
  useImperativeHandle(ref, () => ({
    prefill: (vals) => {
      setValues(prev => ({ ...prev, ...vals }))
      setResult(null)
    },
    getResult: () => result,
    getInputs: () => values,
    getConfig: () => config,
  }))

  // Apply prefillValues when they change externally
  useEffect(() => {
    if (prefillValues) setValues(prev => ({ ...prev, ...prefillValues }))
  }, [prefillValues])

  function validate(key, raw) {
    const f = config.inputs.find(i => i.key === key)
    if (!f) return null
    const n = parseFloat(raw)
    if (isNaN(n)) return 'Required'
    if (f.min != null && n < f.min) return `Min: ${f.min.toLocaleString()}`
    if (f.max != null && n > f.max) return `Max: ${f.max.toLocaleString()}`
    return null
  }

  function handleChange(key, val) {
    setValues(prev => ({ ...prev, [key]: val }))
    setErrors(prev => ({ ...prev, [key]: validate(key, val) }))
  }

  function handleCalculate() {
    const newErrors = {}
    let valid = true
    config.inputs.forEach(inp => {
      const e = validate(inp.key, values[inp.key])
      if (e) { newErrors[inp.key] = e; valid = false }
    })
    setErrors(newErrors)
    if (!valid) return

    const args = config.inputs.map(i => parseFloat(values[i.key]))
    const res  = config.fn(...args)
    setResult(res)
    setExpanded(true)
    onResult?.(config.id, res, values)
  }

  const resultValue = result?.[config.resultKey]
  const colorClass  = config.highlight && resultValue != null
    ? RESULT_COLOR[config.highlight(resultValue)] ?? RESULT_COLOR.neutral
    : RESULT_COLOR.neutral

  const colsClass = config.inputs.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'

  return (
    <div className="panel p-4 flex flex-col gap-3">
      {/* Header */}
      <div>
        <div className="text-[9px] font-mono text-accent uppercase tracking-widest">{config.name}</div>
        {config.description && !compact && (
          <div className="text-[10px] text-gray-500 mt-0.5">{config.description}</div>
        )}
      </div>

      {/* KaTeX formula */}
      <div className="bg-black/30 border border-accent/10 rounded px-2">
        <KatexFormula latex={config.latex} />
      </div>

      {/* Inputs */}
      <div className={`grid ${colsClass} gap-3`}>
        {config.inputs.map(inp => (
          <div key={inp.key}>
            <label className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block mb-1">
              {inp.label}
            </label>
            <div className="flex">
              <input
                type="number"
                step="any"
                value={values[inp.key]}
                onChange={e => handleChange(inp.key, e.target.value)}
                className={`flex-1 min-w-0 bg-navy-800/60 border rounded-l px-2 py-1.5 text-[12px] font-mono
                  text-white focus:outline-none focus:border-accent transition-colors
                  ${errors[inp.key] ? 'border-red-500 bg-red-900/10' : 'border-accent/30 hover:border-accent/50'}`}
              />
              <span className="shrink-0 bg-accent/15 border border-l-0 border-accent/30 rounded-r
                px-2 py-1.5 text-[10px] font-mono text-accent whitespace-nowrap">
                {inp.unit}
              </span>
            </div>
            {errors[inp.key] && (
              <div className="text-red-400 text-[9px] font-mono mt-0.5">{errors[inp.key]}</div>
            )}
          </div>
        ))}
      </div>

      {/* Calculate button */}
      <button
        type="button"
        onClick={handleCalculate}
        className="w-full py-2 bg-accent hover:bg-accent-light text-white font-mono text-[12px]
          rounded transition-colors tracking-wide"
      >
        Calculate
      </button>

      {/* Result */}
      {result != null && resultValue != null && (
        <div className="bg-black/20 border border-accent/20 rounded p-3">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-mono text-gray-500">{config.resultLabel} =</span>
            <span className={`font-mono text-2xl font-bold ${colorClass}`}>
              {Math.abs(resultValue) >= 10000
                ? resultValue.toLocaleString(undefined, { maximumFractionDigits: 1 })
                : resultValue.toFixed(3).replace(/\.?0+$/, '')}
            </span>
            <span className="text-accent font-mono text-sm">{config.resultUnit}</span>
          </div>

          {/* Highlight annotation */}
          {config.highlight && (
            <div className={`text-[10px] font-mono mt-1 ${colorClass}`}>
              {config.id === 'twr' && (resultValue > 1.0
                ? `✓ Viable liftoff (TWR ${resultValue.toFixed(2)} > 1.0)`
                : `✗ Insufficient thrust (TWR ${resultValue.toFixed(2)} < 1.0)`)}
              {config.id === 'tsiolkovsky' && (resultValue >= 9400
                ? `✓ Sufficient for LEO (${resultValue.toFixed(0)} m/s ≥ 9 400 m/s)`
                : `✗ Insufficient for LEO (${resultValue.toFixed(0)} m/s < 9 400 m/s)`)}
              {config.id === 'reentry-decel' && (resultValue < 6
                ? `✓ Mild reentry (${resultValue.toFixed(1)} g)`
                : resultValue < 12
                  ? `⚠ Moderate reentry (${resultValue.toFixed(1)} g)`
                  : `✗ Extreme reentry (${resultValue.toFixed(1)} g)`)}
            </div>
          )}

          {/* Toggle working steps */}
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="mt-2 text-[10px] font-mono text-gray-500 hover:text-accent transition-colors"
          >
            {expanded ? '▲ Hide working' : '▼ Show working'}
          </button>
          {expanded && <WorkingSteps steps={result.working} />}
        </div>
      )}
    </div>
  )
})

export default FormulaCard
