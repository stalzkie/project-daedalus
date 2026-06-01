import { jsPDF } from 'jspdf'

function fmt(v) {
  if (v == null) return '—'
  if (typeof v === 'number')
    return Math.abs(v) >= 1000
      ? v.toLocaleString(undefined, { maximumFractionDigits: 3 })
      : v.toFixed(4).replace(/\.?0+$/, '')
  return String(v)
}

function buildPDF(results, filters) {
  const doc     = new jsPDF({ unit: 'mm', format: 'a4' })
  const W       = 210
  const MARGIN  = 16
  const TEXT_W  = W - MARGIN * 2
  let y         = MARGIN

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function checkPage(needed = 10) {
    if (y + needed > 280) { doc.addPage(); y = MARGIN }
  }
  function h1(text) {
    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(27, 108, 168)
    doc.text(text, MARGIN, y); y += 8
  }
  function h2(text) {
    checkPage(12)
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(200, 220, 255)
    doc.text(text, MARGIN, y); y += 6
    doc.setDrawColor(27, 108, 168)
    doc.line(MARGIN, y, W - MARGIN, y); y += 3
  }
  function h3(text) {
    checkPage(8)
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(100, 180, 255)
    doc.text(text, MARGIN, y); y += 5
  }
  function body(text, indent = 0) {
    checkPage(6)
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(210, 220, 240)
    const lines = doc.splitTextToSize(text, TEXT_W - indent)
    doc.text(lines, MARGIN + indent, y)
    y += lines.length * 4.5
  }
  function mono(text, indent = 4) {
    checkPage(5)
    doc.setFont('courier', 'normal').setFontSize(8).setTextColor(160, 200, 255)
    const lines = doc.splitTextToSize(text, TEXT_W - indent)
    doc.text(lines, MARGIN + indent, y)
    y += lines.length * 4
  }
  function gap(n = 3) { y += n }

  // ─── Cover ───────────────────────────────────────────────────────────────
  doc.setFillColor(11, 31, 75)
  doc.rect(0, 0, 210, 297, 'F')

  h1('Project Daedalus — Calculation Report')
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100, 130, 180)
  doc.text(`Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'medium' })}`, MARGIN, y)
  y += 5
  doc.text(`Module 3 · Mission Calculator & Simulator`, MARGIN, y)
  y += 10

  // ─── Results ─────────────────────────────────────────────────────────────
  if (!results?.length) {
    body('No calculations have been performed yet.')
  } else {
    h2('Calculation Results')
    results.forEach((r) => {
      h3(`${r.name}`)
      body(`Description: ${r.description ?? '—'}`)

      // Inputs table
      body('Inputs:')
      r.inputs?.forEach(inp => {
        mono(`  ${inp.label}: ${fmt(inp.value)} ${inp.unit}`, 4)
      })
      gap(2)

      // Result
      if (r.resultValue != null) {
        const line = `${r.resultLabel} = ${fmt(r.resultValue)} ${r.resultUnit}`
        doc.setFont('courier', 'bold').setFontSize(11).setTextColor(100, 200, 150)
        checkPage(8)
        doc.text(line, MARGIN + 4, y); y += 7
      }

      // Working steps
      if (r.working?.length) {
        body('Working:')
        r.working.forEach((s, i) => {
          mono(`  ${i + 1}. ${s.description}   → ${fmt(s.value)} ${s.unit}`, 4)
        })
      }
      gap(5)
    })
  }

  // ─── Data sources ─────────────────────────────────────────────────────────
  h2('Data Sources')
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  body('All physical constants used in these calculations are from CODATA 2018 recommendations.')
  gap(2)
  if (filters?.dbUsed) {
    body(`Vehicle configuration data retrieved from The Space Devs Launch Library 2 API (v2.2.0):`)
    mono(`  https://ll.thespacedevs.com/2.2.0/config/launcher/`)
    body(`  Retrieved ${dateStr} via Project Daedalus Module 3.`)
  }
  gap(2)
  body('Atmospheric density model: International Standard Atmosphere (ISO 2533:1975), simplified.')
  body('Trajectory simulation uses forward Euler integration with 1 s timestep (not suitable for precision guidance).')

  return doc
}

export default function ExportReport({ results, dbUsed }) {
  function handleExport() {
    const doc = buildPDF(results, { dbUsed })
    doc.save(`daedalus-calc-report-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const count = results?.length ?? 0

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-3">
        <div>
          <div className="text-[10px] font-mono text-accent uppercase tracking-widest">Export PDF Report</div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {count > 0
              ? `${count} calculation${count > 1 ? 's' : ''} ready to export`
              : 'Run at least one calculation to enable export'}
          </div>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={count === 0}
          className="ml-auto px-4 py-2 bg-accent hover:bg-accent-light text-white font-mono text-[11px]
            rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          ↓ Generate PDF
        </button>
      </div>
    </div>
  )
}
