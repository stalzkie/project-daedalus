import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import jsPDF from 'jspdf'
import { STAGE_COLORS } from './FailureTaxonomyChart'

// ─── Inline vehicle specs (adapted from dashboard VehicleSpecs) ────────────

function SpecRow({ label, value, unit }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'rgba(185,28,28,0.1)' }}>
      <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">{label}</span>
      <span className="font-mono text-[11px] font-semibold text-white">
        {value != null ? <>{value}<span className="text-[9px] text-gray-500 ml-1">{unit}</span></> : <span className="text-gray-600">N/A</span>}
      </span>
    </div>
  )
}

function VehiclePanel({ cfg }) {
  if (!cfg) return null
  return (
    <div>
      <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-2">
        Vehicle · {cfg.full_name || cfg.name}
      </div>
      <SpecRow label="Stages"      value={cfg.max_stage}   unit="stages" />
      <SpecRow label="Thrust (SL)" value={cfg.to_thrust != null ? cfg.to_thrust.toLocaleString() : null} unit="kN" />
      <SpecRow label="LEO Cap."    value={cfg.leo_capacity != null ? cfg.leo_capacity.toLocaleString() : null} unit="kg" />
      <SpecRow label="GTO Cap."    value={cfg.gto_capacity != null ? cfg.gto_capacity.toLocaleString() : null} unit="kg" />
    </div>
  )
}

// ─── PDF export ────────────────────────────────────────────────────────────

function exportPDF(failure) {
  const doc  = new jsPDF({ unit: 'mm', format: 'a4' })
  const LINE = 6
  let y = 20

  const write = (text, opts = {}) => {
    doc.setFontSize(opts.size || 10)
    doc.setFont('helvetica', opts.style || 'normal')
    doc.setTextColor(...(opts.color || [230, 230, 230]))
    const lines = doc.splitTextToSize(String(text || '—'), 170)
    doc.text(lines, 20, y)
    y += LINE * lines.length * (opts.extra || 1)
  }

  doc.setFillColor(11, 31, 75)
  doc.rect(0, 0, 210, 297, 'F')

  write('LAUNCH FAILURE REPORT', { size: 16, style: 'bold', color: [185, 28, 28], extra: 2 })
  write('Project Garuda · Failure Database', { size: 9, color: [100, 116, 139] })
  y += 4

  write(failure.name, { size: 14, style: 'bold' })
  write(`Date: ${failure.net ? new Date(failure.net).toDateString() : '—'}`, { size: 9, color: [156, 163, 175] })
  write(`Agency: ${failure.launch_service_provider?.name || '—'}`, { size: 9, color: [156, 163, 175] })
  write(`Vehicle: ${failure.rocket?.configuration?.full_name || failure.rocket?.configuration?.name || '—'}`, { size: 9, color: [156, 163, 175] })
  y += 4

  write('FAILURE PROFILE', { size: 10, style: 'bold', color: [185, 28, 28], extra: 1.2 })
  const fp = failure.failureProfile || {}
  write(`Stage:    ${fp.stage || '—'}`)
  write(`Severity: ${fp.severity === 'partial' ? 'Partial Failure' : 'Total Loss'}`)
  write(`RUD:      ${fp.isRUD ? 'Yes — Rapid Unscheduled Disassembly' : 'No'}`)
  write(`FTS:      ${fp.isFTS ? 'Yes — Flight Termination System activated' : 'No'}`)
  y += 4

  write('OFFICIAL FAILURE REASON', { size: 10, style: 'bold', color: [185, 28, 28], extra: 1.2 })
  write(failure.failreason || 'No failure reason recorded in LL2.', { size: 9, color: [209, 213, 219] })
  y += 4

  if (failure.mission?.description) {
    write('MISSION DESCRIPTION', { size: 10, style: 'bold', color: [185, 28, 28], extra: 1.2 })
    write(failure.mission.description, { size: 9, color: [156, 163, 175] })
    y += 4
  }

  write('DATA PROVENANCE', { size: 10, style: 'bold', color: [185, 28, 28], extra: 1.2 })
  write('Source: Space-Track.org — SATCAT (US Space Surveillance Network)', { size: 8, color: [100, 116, 139] })
  write('Endpoint: /basicspacedata/query/class/satcat/OBJECT_TYPE/PAYLOAD/CURRENT/N', { size: 7, color: [75, 85, 99] })
  write('Note: failure inferred from rapid orbital decay (≤7 days post-launch).', { size: 7, color: [75, 85, 99] })
  write(`Generated: ${new Date().toISOString()}`, { size: 8, color: [100, 116, 139] })

  doc.save(`failure_report_${failure.id || 'unknown'}.pdf`)
}

// ─── Main panel ────────────────────────────────────────────────────────────

export default function FailureDetailPanel({ failure, onClose }) {
  const navigate = useNavigate()
  const open = !!failure

  useEffect(() => {
    if (!open) return
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const fp  = failure?.failureProfile
  const cfg = failure?.rocket?.configuration
  const stageColor = fp?.stage ? (STAGE_COLORS[fp.stage] || '#6B7280') : '#6B7280'

  return (
    <aside
      className={`fixed inset-y-0 right-0 w-[460px] max-w-full z-50 flex flex-col overflow-y-auto
        border-l transition-transform duration-300`}
      style={{
        background: '#0B1F4B',
        borderColor: 'rgba(185,28,28,0.35)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
      }}
    >
      {!failure ? null : (
        <>
          {/* Header */}
          <div className="flex items-start gap-3 p-4 border-b shrink-0"
               style={{ borderColor: 'rgba(185,28,28,0.2)' }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {fp?.severity === 'partial' ? (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border bg-amber-900/50 text-amber-400 border-amber-700">
                    PARTIAL
                  </span>
                ) : (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border bg-red-900/50 text-red-400 border-red-700">
                    TOTAL LOSS
                  </span>
                )}
                {fp?.isRUD && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded text-white"
                        style={{ background: '#991B1B' }}>🔥 RUD</span>
                )}
                {fp?.isFTS && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded text-white"
                        style={{ background: '#B45309' }}>⚠ FTS</span>
                )}
                <span className="text-[10px] font-mono text-gray-500">
                  {failure.net ? new Date(failure.net).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                </span>
              </div>
              <h2 className="text-sm font-bold text-white leading-snug">{failure.name}</h2>
              <div className="text-[11px] mt-0.5" style={{ color: '#B91C1C' }}>
                {failure.launch_service_provider?.name}
              </div>
            </div>
            <button type="button" onClick={onClose}
                    className="text-gray-500 hover:text-white text-xl leading-none shrink-0">✕</button>
          </div>

          <div className="p-4 space-y-5 flex-1">
            {/* Failure stage */}
            <section>
              <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-2">Failure Stage</div>
              <span className="text-[11px] font-mono font-bold px-2 py-1 rounded border"
                    style={{ borderColor: stageColor + '60', color: stageColor, background: stageColor + '18' }}>
                {fp?.stage || '—'}
              </span>
            </section>

            {/* Official failure reason */}
            <section>
              <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-2">
                Official Failure Reason
              </div>
              <div className="rounded border p-3 text-[11px] font-mono text-gray-200 leading-relaxed"
                   style={{ background: 'rgba(185,28,28,0.06)', borderColor: 'rgba(185,28,28,0.25)' }}>
                {failure.failreason || (
                  <span className="text-gray-600 italic">
                    Not available — Space-Track SATCAT does not record failure reasons.
                    Failure inferred from rapid orbital decay (≤7 days post-launch).
                  </span>
                )}
              </div>
            </section>

            {/* Orbital context from SpaceTrack */}
            {failure._satcat && (
              <section>
                <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-2">Orbital Data</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {[
                    ['NORAD ID',    failure._satcat.norad_id],
                    ['Int. Desig.', failure._satcat.int_desig],
                    ['Period',      failure._satcat.period_min != null ? `${failure._satcat.period_min.toFixed(1)} min` : null],
                    ['Perigee',     failure._satcat.perigee_km != null ? `${failure._satcat.perigee_km} km` : null],
                    ['Apogee',      failure._satcat.apogee_km  != null ? `${failure._satcat.apogee_km} km`  : null],
                    ['Incl.',       failure._satcat.inclination != null ? `${failure._satcat.inclination}°` : null],
                    ['Decayed',     failure._satcat.decay_date ? new Date(failure._satcat.decay_date).toDateString() : null],
                    ['Days in orbit', failure._satcat.days_till_decay != null ? `${failure._satcat.days_till_decay} days` : null],
                  ].filter(([, v]) => v != null).map(([label, value]) => (
                    <div key={label}>
                      <div className="text-[8px] font-mono text-gray-600 uppercase tracking-widest">{label}</div>
                      <div className="text-[11px] font-mono text-gray-200">{value}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Mission */}
            {failure.mission?.description && (
              <section>
                <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-2">Mission</div>
                <p className="text-[11px] text-gray-300 leading-relaxed">{failure.mission.description}</p>
              </section>
            )}

            {/* Launch site */}
            {failure.pad && (
              <section>
                <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-2">Launch Site</div>
                <div className="text-[11px] text-gray-300 font-mono">
                  {failure.pad.name}
                  {failure.pad.location?.name && <span className="text-gray-500"> · {failure.pad.location.name}</span>}
                </div>
              </section>
            )}

            {/* Vehicle specs */}
            <section>
              <VehiclePanel cfg={cfg} />
            </section>

            {/* Actions */}
            <section className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: 'rgba(185,28,28,0.2)' }}>
              <button
                type="button"
                onClick={() => navigate(`/history?mission=${encodeURIComponent(failure.name)}`)}
                className="text-[11px] font-mono px-3 py-2 rounded border text-gray-300 hover:text-white transition-colors text-left"
                style={{ borderColor: 'rgba(185,28,28,0.3)' }}
              >
                ↗ View in History
              </button>
              <button
                type="button"
                onClick={() => exportPDF(failure)}
                className="text-[11px] font-mono px-3 py-2 rounded border text-gray-300 hover:text-white transition-colors text-left"
                style={{ borderColor: 'rgba(185,28,28,0.3)' }}
              >
                ↓ Export Failure Report (PDF)
              </button>
            </section>

            {/* Provenance */}
            <div className="text-[9px] font-mono text-gray-600 leading-relaxed">
              Source: Space-Track.org — SATCAT (Basic Space Data)<br />
              /basicspacedata/query/class/satcat/OBJECT_TYPE/PAYLOAD/CURRENT/N
            </div>
          </div>
        </>
      )}
    </aside>
  )
}
