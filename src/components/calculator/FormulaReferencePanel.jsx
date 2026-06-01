import { useState } from 'react'
import katex from 'katex'
import { FORMULA_CONFIGS } from '../../lib/formulaConfig'

const TAB_LABELS = {
  propulsion: 'Propulsion',
  orbital:    'Orbital Mechanics',
  trajectory: 'Trajectory',
  reentry:    'Reentry',
  simulator:  'Simulator',
}

const groupedFormulas = FORMULA_CONFIGS.reduce((acc, f) => {
  if (!acc[f.tab]) acc[f.tab] = []
  acc[f.tab].push(f)
  return acc
}, {})

function MiniFormula({ latex }) {
  try {
    const html = katex.renderToString(latex, { throwOnError: false, displayMode: false })
    return <span className="katex-dark text-[10px]" dangerouslySetInnerHTML={{ __html: html }} />
  } catch {
    return <code className="text-[9px] text-gray-400">{latex}</code>
  }
}

export default function FormulaReferencePanel({ onNavigate }) {
  const [open, setOpen]           = useState(false)
  const [expandedTab, setExpandedTab] = useState('propulsion')

  return (
    <>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1
          px-1.5 py-4 rounded-l border border-r-0 border-accent/40 font-mono text-[9px]
          transition-all duration-200 writing-mode-vertical
          ${open ? 'bg-accent text-white' : 'bg-navy-800/90 text-accent hover:bg-accent/20'}`}
        style={{ writingMode: 'vertical-rl' }}
        title="Formula Reference"
      >
        {open ? '◀ Close' : '▶ Reference'}
      </button>

      {/* Panel */}
      <aside
        className={`fixed inset-y-0 right-0 z-30 w-72 flex flex-col border-l border-accent/30
          transition-transform duration-250 overflow-y-auto
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: '#080f2e', top: 0, paddingTop: 48 }}
      >
        <div className="px-3 py-2 border-b border-accent/20">
          <div className="text-[10px] font-mono text-accent uppercase tracking-widest">Formula Reference</div>
          <div className="text-[9px] text-gray-500 mt-0.5">Click any formula to navigate</div>
        </div>

        {Object.entries(groupedFormulas).map(([tab, formulas]) => (
          <div key={tab} className="border-b border-accent/10">
            <button
              type="button"
              onClick={() => setExpandedTab(t => t === tab ? '' : tab)}
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono
                text-gray-400 hover:text-white transition-colors"
            >
              <span className="uppercase tracking-widest">{TAB_LABELS[tab] || tab}</span>
              <span className="text-gray-600">{expandedTab === tab ? '▲' : '▼'}</span>
            </button>

            {expandedTab === tab && (
              <div className="space-y-px pb-1">
                {formulas.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => { onNavigate?.(tab, f.id); setOpen(false) }}
                    className="w-full text-left px-3 py-2 hover:bg-accent/10 transition-colors group"
                  >
                    <div className="text-[10px] font-semibold text-white group-hover:text-accent
                      transition-colors truncate">
                      {f.name}
                    </div>
                    <div className="mt-1 overflow-x-hidden">
                      <MiniFormula latex={f.latex} />
                    </div>
                    {f.description && (
                      <div className="text-[8px] text-gray-600 mt-0.5 truncate">{f.description}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Constants quick-ref */}
        <div className="px-3 pt-3 pb-4">
          <div className="text-[9px] font-mono text-accent uppercase tracking-widest mb-2">Constants</div>
          {[
            ['G',    '6.674 × 10⁻¹¹',  'm³ kg⁻¹ s⁻²'],
            ['g₀',   '9.80665',         'm/s²'],
            ['M⊕',   '5.972 × 10²⁴',   'kg'],
            ['R⊕',   '6 371 000',       'm'],
            ['GM',   '3.986 × 10¹⁴',   'm³/s²'],
          ].map(([sym, val, unit]) => (
            <div key={sym} className="flex items-baseline gap-2 text-[9px] font-mono py-0.5">
              <span className="text-accent w-8 shrink-0">{sym}</span>
              <span className="text-white">{val}</span>
              <span className="text-gray-600">{unit}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-20 bg-black/30" onClick={() => setOpen(false)} />
      )}
    </>
  )
}
