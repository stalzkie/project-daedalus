import { useState } from 'react'

function buildCitation(filters, fetchedAt) {
  const date = fetchedAt
    ? new Date(fetchedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const parts = []
  if (filters.outcome)                parts.push(`outcome: ${filters.outcome}`)
  if ((filters.agencies || []).length) parts.push(`agency: ${filters.agencies.join(', ')}`)
  if ((filters.rockets || []).length)  parts.push(`rocket: ${filters.rockets.join(', ')}`)
  if ((filters.orbits || []).length)   parts.push(`orbit: ${filters.orbits.join(', ')}`)
  if (filters.date_from)              parts.push(`from: ${filters.date_from.slice(0, 10)}`)
  if (filters.date_to)                parts.push(`to: ${filters.date_to.slice(0, 10)}`)
  if (filters.payload_min && filters.payload_min > 0)
    parts.push(`payload ≥ ${filters.payload_min.toLocaleString()} kg`)
  if (filters.payload_max && filters.payload_max < 65000)
    parts.push(`payload ≤ ${filters.payload_max.toLocaleString()} kg`)

  const filterStr = parts.length > 0
    ? parts.join('; ')
    : 'none (all past orbital launches)'

  return [
    `The Space Devs (${date}). Launch Library 2 API (v2.2.0) [Dataset].`,
    `https://ll.thespacedevs.com/2.2.0/launch/`,
    `Retrieved ${date} via Project Daedalus Module 2 / History & Comparison.`,
    `Filters applied: ${filterStr}.`,
  ].join('\n')
}

function buildAPA(filters, fetchedAt) {
  const year = new Date(fetchedAt || Date.now()).getFullYear()
  return `The Space Devs. (${year}). Launch Library 2 API [Dataset]. https://ll.thespacedevs.com/2.2.0/launch/`
}

function buildBibTeX(filters, fetchedAt) {
  const year = new Date(fetchedAt || Date.now()).getFullYear()
  const date = new Date(fetchedAt || Date.now()).toISOString().slice(0, 10)
  return `@misc{spacedevs${year},
  author       = {{The Space Devs}},
  title        = {{Launch Library 2 API}},
  year         = {${year}},
  howpublished = {\\url{https://ll.thespacedevs.com/2.2.0/launch/}},
  note         = {Accessed ${date} via Project Daedalus}
}`
}

export default function ExportCitePanel({ filters, fetchedAt, launches }) {
  const [format, setFormat] = useState('standard')
  const [copied, setCopied] = useState(false)

  const citation =
    format === 'apa'    ? buildAPA(filters, fetchedAt)
    : format === 'bibtex' ? buildBibTeX(filters, fetchedAt)
    : buildCitation(filters, fetchedAt)

  async function copy() {
    await navigator.clipboard.writeText(citation)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function exportTableCSV() {
    if (!launches?.length) return
    const headers = ['NET', 'Name', 'Vehicle', 'Agency', 'Orbit', 'LEO Cap (kg)', 'Status']
    const rows = launches.map(l => [
      l.net ? new Date(l.net).toISOString().slice(0, 10) : '',
      `"${l.name || ''}"`,
      `"${l.rocket?.configuration?.name || ''}"`,
      `"${l.launch_service_provider?.name || ''}"`,
      l.mission?.orbit?.abbrev || '',
      l.rocket?.configuration?.payload_leo_kg ?? '',
      l.status?.abbrev || '',
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `daedalus-history-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-mono text-accent tracking-widest uppercase">Export & Citation</span>
      </div>

      {/* Format selector */}
      <div className="flex gap-1 mb-3">
        {[
          { id: 'standard', label: 'Standard' },
          { id: 'apa',      label: 'APA 7'    },
          { id: 'bibtex',   label: 'BibTeX'   },
        ].map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFormat(f.id)}
            className={`text-[10px] font-mono px-2 py-1 rounded border transition-all ${
              format === f.id
                ? 'bg-accent text-white border-accent'
                : 'border-accent/30 text-gray-400 hover:text-white hover:border-accent/60'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Citation text */}
      <pre className="text-[11px] font-mono text-gray-300 bg-black/30 border border-accent/20 rounded p-3 whitespace-pre-wrap leading-relaxed mb-3">
        {citation}
      </pre>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="text-[10px] font-mono px-3 py-1.5 bg-accent hover:bg-accent-light text-white rounded transition-colors"
        >
          {copied ? '✓ Copied' : 'Copy Citation'}
        </button>
        <button
          type="button"
          onClick={exportTableCSV}
          disabled={!launches?.length}
          className="text-[10px] font-mono px-3 py-1.5 border border-accent/30 text-gray-400 hover:text-white hover:border-accent/60 rounded transition-colors disabled:opacity-40"
        >
          ↓ Export Table as CSV
        </button>
        <span className="ml-auto text-[9px] font-mono text-gray-600">
          {launches?.length ?? 0} launches in current view
        </span>
      </div>
    </div>
  )
}
