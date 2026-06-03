import { useState, useCallback } from 'react'
import axios from 'axios'

export default function LoadFromDatabase({ onSelect, activeTab }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const search = useCallback(async () => {
    const q = query.trim()
    if (!q) return
    setLoading(true); setError(null)
    try {
      const { data } = await axios.get(`/api/launches/vehicle-config?name=${encodeURIComponent(q)}`)
      setResults(data.results || [])
      if (!data.results?.length) setError('No matching vehicles found.')
    } catch (e) {
      setError(e.response?.data?.message || 'Search failed — is the API server running?')
    } finally {
      setLoading(false)
    }
  }, [query])

  function handleKey(e) {
    if (e.key === 'Enter') search()
  }

  return (
    <div className="panel p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[9px] font-mono text-accent tracking-widest uppercase">Load from LL2 Database</span>
        <span className="text-[9px] font-mono text-gray-600">— pre-fill formula inputs with real vehicle specs</span>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="e.g. Falcon 9, Atlas V, Ariane 5…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          className="flex-1 bg-white border border-[rgba(27,108,168,0.25)] rounded px-3 py-1.5 text-[12px]
            font-mono text-[#1A1F36] placeholder-gray-400 focus:outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={search}
          disabled={loading || !query.trim()}
          className="px-4 py-1.5 bg-accent hover:bg-accent-light text-white font-mono text-[11px]
            rounded transition-colors disabled:opacity-40"
        >
          {loading ? '…' : 'Search'}
        </button>
      </div>

      {error && <div className="text-red-600 text-[10px] font-mono mb-2">{error}</div>}

      {results.length > 0 && (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {results.map(v => (
            <VehicleResult key={v.id} vehicle={v} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

function VehicleResult({ vehicle: v, onSelect }) {
  const [expanded, setExpanded] = useState(false)

  const fields = [
    { label: 'Thrust',      value: v.thrust_N    != null ? `${(v.thrust_N / 1000).toLocaleString()} kN` : 'N/A' },
    { label: 'Launch mass', value: v.totalMass_kg != null ? `${(v.totalMass_kg / 1000).toFixed(1)} t`    : 'N/A' },
    { label: 'LEO cap.',    value: v.payloadLEO_kg != null ? `${v.payloadLEO_kg.toLocaleString()} kg`    : 'N/A' },
    { label: 'GTO cap.',    value: v.payloadGTO_kg != null ? `${v.payloadGTO_kg.toLocaleString()} kg`    : 'N/A' },
    { label: 'Stages',      value: v.stages ?? 'N/A' },
    { label: 'Diameter',    value: v.diameter_m != null ? `${v.diameter_m} m` : 'N/A' },
    { label: 'Isp (vac)',   value: v.isp_vac_s  != null ? `${v.isp_vac_s} s`  : 'Not in LL2' },
    { label: 'Launches',    value: v.launchCount ?? '—' },
  ]

  return (
    <div className="border border-accent/20 rounded bg-[#F8FAFC]">
      <div className="flex items-center gap-2 px-3 py-2">
        {v.imageUrl && (
          <img src={v.imageUrl} alt="" className="w-8 h-8 object-cover rounded shrink-0 opacity-80" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-[#1A1F36] truncate">{v.name}</div>
          <div className="text-[9px] font-mono text-gray-500">{v.manufacturer} · {v.family}</div>
        </div>
        {v.successRate != null && (
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
            v.successRate >= 95 ? 'bg-green-50 text-green-700 border-green-300' :
            v.successRate >= 80 ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-red-50 text-red-700 border-red-300'
          }`}>
            {v.successRate}%
          </span>
        )}
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="text-gray-500 hover:text-[#1A1F36] text-[10px] font-mono"
        >
          {expanded ? '▲' : '▼'}
        </button>
        <button
          type="button"
          onClick={() => onSelect(v)}
          className="text-[10px] font-mono px-2 py-1 bg-accent/10 hover:bg-accent text-accent
            hover:text-white border border-accent/30 rounded transition-colors whitespace-nowrap"
        >
          Use values
        </button>
      </div>

      {expanded && (
        <div className="grid grid-cols-4 gap-px border-t border-accent/10">
          {fields.map(f => (
            <div key={f.label} className="px-2 py-1.5">
              <div className="text-[8px] font-mono text-gray-500 uppercase">{f.label}</div>
              <div className="text-[10px] font-mono text-[#1A1F36]">{f.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
