/**
 * Small info badge that shows source API + fetched_at on hover.
 * Rendered as a tooltip anchor in the top-right corner of each panel.
 */
export default function DataSourceTag({ source, fetchedAt }) {
  const timeStr = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '—'

  return (
    <div className="ds-tooltip inline-flex items-center ml-auto shrink-0">
      <button
        type="button"
        className="w-4 h-4 rounded-full border border-accent text-accent flex items-center justify-center text-[9px] font-bold leading-none hover:bg-accent hover:text-white transition-colors"
        aria-label="Data source info"
      >
        i
      </button>
      <div className="ds-tooltip-content text-gray-600">
        <div className="text-accent font-semibold mb-1">Data Source</div>
        <div><span className="text-gray-400">src:</span> {source}</div>
        <div><span className="text-gray-400">at: </span> {timeStr}</div>
      </div>
    </div>
  )
}
