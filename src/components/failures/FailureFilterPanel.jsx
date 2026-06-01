import { useState } from 'react'

const FAILURE_STAGES = [
  'Stage 1 / Booster',
  'Stage 2',
  'Upper Stage',
  'Payload / Deployment',
  'Guidance & Navigation',
  'Software / Avionics',
  'FTS / Range Safety',
  'Unknown / Under Investigation',
]

const SEVERITIES = [
  { value: '',        label: 'All'      },
  { value: 'total',   label: 'Total'    },
  { value: 'partial', label: 'Partial'  },
]

function Section({ label, open, onToggle, children }) {
  return (
    <div className="border-b" style={{ borderColor: 'rgba(185,28,28,0.12)' }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono text-gray-400 hover:text-white transition-colors"
      >
        <span className="uppercase tracking-widest">{label}</span>
        <span className="text-gray-600">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

function CheckItem({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group py-0.5">
      <input type="checkbox" checked={checked} onChange={onChange}
             className="w-3 h-3 rounded" style={{ accentColor: '#B91C1C' }} />
      <span className={`text-[11px] transition-colors ${checked ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
        {label}
      </span>
    </label>
  )
}

export default function FailureFilterPanel({ filters, onChange, onClear, activeCount, agencies }) {
  const [stageOpen,    setStageOpen]    = useState(true)
  const [agencyOpen,   setAgencyOpen]   = useState(true)
  const [severityOpen, setSeverityOpen] = useState(true)
  const [decadeOpen,   setDecadeOpen]   = useState(false)

  function setField(field, value) { onChange({ ...filters, [field]: value }) }

  function toggleStage(s) {
    const cur = filters.stages || []
    setField('stages', cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s])
  }

  function toggleAgency(a) {
    const cur = filters.agencies || []
    setField('agencies', cur.includes(a) ? cur.filter(x => x !== a) : [...cur, a])
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col overflow-y-auto"
           style={{ borderRight: '1px solid rgba(185,28,28,0.2)' }}>
      <div className="flex items-center justify-between px-3 py-2.5"
           style={{ borderBottom: '1px solid rgba(185,28,28,0.2)' }}>
        <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#B91C1C' }}>
          Filters
        </span>
        {activeCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                  style={{ background: '#B91C1C' }}>
              {activeCount}
            </span>
            <button type="button" onClick={onClear}
                    className="text-[10px] font-mono text-gray-400 hover:text-white transition-colors">
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Decade range */}
      <Section label="Decade Range" open={decadeOpen} onToggle={() => setDecadeOpen(o => !o)}>
        <div className="space-y-2 pt-1">
          <div className="flex justify-between text-[9px] font-mono text-gray-500">
            <span>{filters.decadeMin ?? 1950}s</span>
            <span>{filters.decadeMax ?? 2020}s</span>
          </div>
          <input type="range" min={1950} max={2020} step={10}
                 value={filters.decadeMin ?? 1950}
                 onChange={e => setField('decadeMin', +e.target.value)}
                 className="w-full" style={{ accentColor: '#B91C1C' }} />
          <input type="range" min={1950} max={2020} step={10}
                 value={filters.decadeMax ?? 2020}
                 onChange={e => setField('decadeMax', +e.target.value)}
                 className="w-full" style={{ accentColor: '#B91C1C' }} />
        </div>
      </Section>

      {/* Severity */}
      <Section label="Severity" open={severityOpen} onToggle={() => setSeverityOpen(o => !o)}>
        <div className="flex flex-wrap gap-1 pt-1">
          {SEVERITIES.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setField('severity', opt.value)}
              className="text-[10px] font-mono px-2 py-0.5 rounded border transition-all"
              style={filters.severity === opt.value
                ? { background: '#B91C1C', color: '#fff', borderColor: '#B91C1C' }
                : { borderColor: 'rgba(185,28,28,0.3)', color: '#9CA3AF' }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Section>

      {/* RUD / FTS toggles */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid rgba(185,28,28,0.12)' }}>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!filters.rudOnly}
                   onChange={e => setField('rudOnly', e.target.checked)}
                   style={{ accentColor: '#B91C1C' }} className="w-3 h-3" />
            <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
              <span className="text-red-500">🔥</span> RUD only
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!filters.ftsOnly}
                   onChange={e => setField('ftsOnly', e.target.checked)}
                   style={{ accentColor: '#D97706' }} className="w-3 h-3" />
            <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
              <span className="text-amber-500">⚠</span> FTS only
            </span>
          </label>
        </div>
      </div>

      {/* Failure Stage */}
      <Section label="Failure Stage" open={stageOpen} onToggle={() => setStageOpen(o => !o)}>
        <div className="space-y-0.5 pt-1">
          {FAILURE_STAGES.map(s => (
            <CheckItem
              key={s}
              label={s}
              checked={(filters.stages || []).includes(s)}
              onChange={() => toggleStage(s)}
            />
          ))}
        </div>
      </Section>

      {/* Agency */}
      <Section label="Agency" open={agencyOpen} onToggle={() => setAgencyOpen(o => !o)}>
        <div className="space-y-0.5 max-h-40 overflow-y-auto pt-1">
          {(agencies || []).map(a => (
            <CheckItem
              key={a}
              label={a}
              checked={(filters.agencies || []).includes(a)}
              onChange={() => toggleAgency(a)}
            />
          ))}
        </div>
      </Section>
    </aside>
  )
}
