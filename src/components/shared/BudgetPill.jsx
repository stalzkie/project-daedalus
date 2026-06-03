/**
 * Shows remaining LL2 API budget for the current hour.
 * Green → plenty of budget. Yellow → low. Red → exhausted.
 */
export default function BudgetPill({ budget }) {
  if (!budget) return null

  const { used, remaining, max, resetAt } = budget
  const pct = remaining / max

  const color =
    pct > 0.4 ? 'text-green-600 border-green-400/50' :
    pct > 0.1 ? 'text-yellow-600 border-yellow-400/50' :
                'text-red-600 border-red-400/50'

  const resetTime = resetAt
    ? new Date(resetAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null

  const title = remaining === 0
    ? `LL2 rate limit exhausted. Resets at ${resetTime ?? '—'}`
    : `LL2 API: ${used}/${max} requests used this hour${resetTime ? `. Resets at ${resetTime}` : ''}`

  return (
    <span
      className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${color} cursor-default`}
      title={title}
    >
      {remaining}/{max} req
    </span>
  )
}
