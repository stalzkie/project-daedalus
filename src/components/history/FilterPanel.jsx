import { useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

const AGENCIES = [
  'SpaceX', 'United Launch Alliance', 'Arianespace', 'Roscosmos',
  'ISRO', 'CASC', 'JAXA', 'Rocket Lab', 'Blue Origin',
  'Northrop Grumman', 'NASA', 'ESA',
]
const ORBIT_CLASSES = ['LEO', 'MEO', 'GEO', 'GTO', 'SSO', 'HEO', 'ISS', 'VLEO', 'POLAR', 'TLI']
const ROCKET_FAMILIES = [
  'Falcon 9', 'Falcon Heavy', 'Atlas V', 'Delta IV', 'Vulcan',
  'Ariane 5', 'Ariane 6', 'Soyuz', 'Long March', 'PSLV',
  'Electron', 'New Shepard', 'H-IIA', 'H3', 'Vega',
]
const OUTCOME_OPTIONS = [
  { value: '',         label: 'All'     },
  { value: 'success',  label: 'Success' },
  { value: 'failure',  label: 'Failure' },
  { value: 'partial',  label: 'Partial' },
]

export default function FilterPanel({ filters, onChange, onClear, activeCount }) {
  const [agencyOpen, setAgencyOpen]     = useState(true)
  const [rocketOpen, setRocketOpen]     = useState(true)
  const [orbitOpen, setOrbitOpen]       = useState(true)
  const [payloadOpen, setPayloadOpen]   = useState(false)

  function toggle(field, value) {
    const current = filters[field] || []
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    onChange({ ...filters, [field]: next })
  }

  function setField(field, value) {
    onChange({ ...filters, [field]: value })
  }

  return (
    <aside className="w-64 shrink-0 flex flex-col gap-0 overflow-y-auto panel">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-accent/20">
        <span className="text-[10px] font-mono text-accent tracking-widest uppercase">Filters</span>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <span className="bg-accent text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] font-mono text-gray-400 hover:text-white transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Date range */}
      <Section label="Date Range" defaultOpen>
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">From</label>
          <DatePicker
            selected={filters.date_from ? new Date(filters.date_from) : null}
            onChange={d => setField('date_from', d ? d.toISOString() : '')}
            placeholderText="1957-10-04"
            dateFormat="yyyy-MM-dd"
            className="w-full bg-navy-800 border border-accent/30 rounded px-2 py-1 text-[11px] font-mono text-white placeholder-gray-600 focus:outline-none focus:border-accent"
            wrapperClassName="w-full"
            maxDate={filters.date_to ? new Date(filters.date_to) : new Date()}
          />
          <label className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">To</label>
          <DatePicker
            selected={filters.date_to ? new Date(filters.date_to) : null}
            onChange={d => setField('date_to', d ? d.toISOString() : '')}
            placeholderText={new Date().toISOString().slice(0, 10)}
            dateFormat="yyyy-MM-dd"
            className="w-full bg-navy-800 border border-accent/30 rounded px-2 py-1 text-[11px] font-mono text-white placeholder-gray-600 focus:outline-none focus:border-accent"
            wrapperClassName="w-full"
            minDate={filters.date_from ? new Date(filters.date_from) : undefined}
            maxDate={new Date()}
          />
        </div>
      </Section>

      {/* Outcome */}
      <Section label="Outcome" defaultOpen>
        <div className="flex flex-wrap gap-1">
          {OUTCOME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setField('outcome', opt.value)}
              className={`text-[10px] font-mono px-2 py-1 rounded border transition-all ${
                filters.outcome === opt.value
                  ? 'bg-accent text-white border-accent'
                  : 'border-accent/30 text-gray-400 hover:border-accent/60 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Agency */}
      <Section label="Agency" open={agencyOpen} onToggle={() => setAgencyOpen(o => !o)}>
        <div className="space-y-1 max-h-44 overflow-y-auto">
          {AGENCIES.map(a => (
            <CheckItem
              key={a}
              label={a}
              checked={(filters.agencies || []).includes(a)}
              onChange={() => toggle('agencies', a)}
            />
          ))}
        </div>
      </Section>

      {/* Rocket family */}
      <Section label="Rocket Family" open={rocketOpen} onToggle={() => setRocketOpen(o => !o)}>
        <div className="space-y-1 max-h-44 overflow-y-auto">
          {ROCKET_FAMILIES.map(r => (
            <CheckItem
              key={r}
              label={r}
              checked={(filters.rockets || []).includes(r)}
              onChange={() => toggle('rockets', r)}
            />
          ))}
        </div>
      </Section>

      {/* Orbit class */}
      <Section label="Orbit Class" open={orbitOpen} onToggle={() => setOrbitOpen(o => !o)}>
        <div className="flex flex-wrap gap-1">
          {ORBIT_CLASSES.map(o => (
            <button
              key={o}
              type="button"
              onClick={() => toggle('orbits', o)}
              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${
                (filters.orbits || []).includes(o)
                  ? 'bg-accent/30 text-accent border-accent'
                  : 'border-accent/20 text-gray-500 hover:text-white hover:border-accent/40'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </Section>

      {/* Payload capacity range */}
      <Section label="Payload Cap. (kg)" open={payloadOpen} onToggle={() => setPayloadOpen(o => !o)}>
        <div className="px-1 space-y-2">
          <input
            type="range"
            min={0}
            max={65000}
            step={500}
            value={filters.payload_max ?? 65000}
            onChange={e => setField('payload_max', parseInt(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[9px] font-mono text-gray-500">
            <span>0 kg</span>
            <span className="text-white">{(filters.payload_max ?? 65000).toLocaleString()} kg</span>
            <span>65,000 kg</span>
          </div>
          <input
            type="range"
            min={0}
            max={65000}
            step={500}
            value={filters.payload_min ?? 0}
            onChange={e => setField('payload_min', parseInt(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[9px] font-mono text-gray-500">
            <span>Min: <span className="text-white">{(filters.payload_min ?? 0).toLocaleString()} kg</span></span>
          </div>
        </div>
      </Section>
    </aside>
  )
}

function Section({ label, children, defaultOpen, open, onToggle }) {
  const [localOpen, setLocalOpen] = useState(defaultOpen ?? true)
  const isOpen = onToggle ? open : localOpen
  const toggle = onToggle || (() => setLocalOpen(o => !o))

  return (
    <div className="border-b border-accent/10">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono text-gray-400 hover:text-white transition-colors"
      >
        <span className="uppercase tracking-widest">{label}</span>
        <span className="text-gray-600">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

function CheckItem({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-3 h-3 accent-accent rounded"
      />
      <span className={`text-[11px] transition-colors ${checked ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
        {label}
      </span>
    </label>
  )
}
