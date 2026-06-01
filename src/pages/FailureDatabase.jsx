import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import NavBar from '../components/shared/NavBar'
import BudgetPill from '../components/shared/BudgetPill'
import { useBudget } from '../hooks/useBudget'
import FailureStatsBar        from '../components/failures/FailureStatsBar'
import FailureTaxonomyChart   from '../components/failures/FailureTaxonomyChart'
import FailureTimelineChart   from '../components/failures/FailureTimelineChart'
import FailureSearchTable     from '../components/failures/FailureSearchTable'
import FailureDetailPanel     from '../components/failures/FailureDetailPanel'

async function fetchFailures() {
  try {
    const { data } = await axios.get('/api/failures/all')
    return data
  } catch (err) {
    const body = err.response?.data
    const enriched = new Error(body?.message || err.message)
    enriched.isRateLimit = err.response?.status === 429 || body?.error === 'rate_limit'
    throw enriched
  }
}

async function fetchStats() {
  try {
    const { data } = await axios.get('/api/failures/stats')
    return data
  } catch (err) {
    const body = err.response?.data
    const enriched = new Error(body?.message || err.message)
    enriched.isRateLimit = err.response?.status === 429 || body?.error === 'rate_limit'
    throw enriched
  }
}

export default function FailureDatabase() {
  const [selectedFailure, setSelectedFailure] = useState(null)

  const {
    data: allData, isLoading, isError, error, dataUpdatedAt,
  } = useQuery({
    queryKey: ['failures/all'],
    queryFn: fetchFailures,
    staleTime: 30 * 60_000,
    retry: (count, err) => !err?.isRateLimit && count < 2,
  })

  const { data: statsData } = useQuery({
    queryKey: ['failures/stats'],
    queryFn: fetchStats,
    staleTime: 30 * 60_000,
    retry: (count, err) => !err?.isRateLimit && count < 2,
  })

  const { data: apiStatus } = useBudget()
  const isRateLimit = isError && error?.isRateLimit

  const failures  = allData?.results || []
  const fetchedAt = allData?._meta?.fetchedAt ||
                    (dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null)

  const handleRowClick   = useCallback(f => setSelectedFailure(f), [])
  const handlePanelClose = useCallback(() => setSelectedFailure(null), [])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0B1F4B' }}>
      <NavBar />

      {/* Sub-header */}
      <header className="border-b px-4 py-1.5 flex items-center gap-3 shrink-0"
              style={{ borderColor: 'rgba(185,28,28,0.25)' }}>
        <span className="text-[11px] font-mono text-gray-500">MODULE 4 · LAUNCH FAILURE DATABASE</span>
        <div className="ml-auto flex items-center gap-3 text-[10px] font-mono">
          {isLoading && (
            <span className="flex items-center gap-1 text-gray-500">
              <span className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: '#B91C1C', borderTopColor: 'transparent' }} />
              Fetching failure records…
            </span>
          )}
          {isError && !isRateLimit && (
            <span style={{ color: '#B91C1C' }}>API error</span>
          )}
          <BudgetPill budget={apiStatus?.budget} />
          <span className="px-1.5 py-0.5 rounded font-mono text-[10px]"
                style={isRateLimit
                  ? { background: 'rgba(120,53,15,0.5)', color: '#FCD34D' }
                  : isError
                  ? { background: 'rgba(127,29,29,0.5)', color: '#F87171' }
                  : { background: 'rgba(185,28,28,0.2)', color: '#B91C1C' }
                }>
            {isRateLimit ? '429' : isError ? 'ERR' : isLoading
              ? 'LOADING'
              : `${(allData?.count ?? 0).toLocaleString()} failures`}
          </span>
        </div>
      </header>

      <main className="p-4 space-y-4 flex-1">
        {/* Rate limit warning */}
        {isRateLimit && (
          <div className="panel p-4 font-mono text-sm text-center" style={{ borderColor: 'rgba(185,28,28,0.4)' }}>
            <div className="text-amber-400 text-base mb-2">⚠ LL2 API Rate Limit Exceeded</div>
            <div className="text-gray-300 text-[12px] leading-relaxed">
              The failures database will retry automatically in <strong className="text-white">~1 hour</strong>.
            </div>
          </div>
        )}

        {isError && !isRateLimit && (
          <div className="panel p-4 font-mono text-sm text-center" style={{ borderColor: 'rgba(185,28,28,0.4)' }}>
            <span style={{ color: '#B91C1C' }}>Failed to fetch failure data. Is the API server running on port 3001?</span>
          </div>
        )}

        {/* Stats bar */}
        <FailureStatsBar stats={statsData} fetchedAt={fetchedAt} />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FailureTaxonomyChart stats={statsData} fetchedAt={fetchedAt} />
          <FailureTimelineChart stats={statsData} fetchedAt={fetchedAt} />
        </div>

        {/* Search + table */}
        <FailureSearchTable
          failures={failures}
          isLoading={isLoading}
          fetchedAt={fetchedAt}
          onRowClick={handleRowClick}
        />
      </main>

      <footer className="border-t px-4 py-2 flex items-center justify-between text-[9px] font-mono text-gray-600 shrink-0"
              style={{ borderColor: 'rgba(185,28,28,0.2)' }}>
        <span>PROJECT GARUDA · MODULE 4 · FAILURE DATABASE</span>
        <span>Source: Space-Track SATCAT (payloads decayed ≤7 days post-launch) · 24 hr cache</span>
      </footer>

      {/* Detail panel */}
      <FailureDetailPanel failure={selectedFailure} onClose={handlePanelClose} />
    </div>
  )
}
