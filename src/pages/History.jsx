import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import NavBar from '../components/shared/NavBar'
import BudgetPill from '../components/shared/BudgetPill'
import { useBudget } from '../hooks/useBudget'
import FilterPanel from '../components/history/FilterPanel'
import LaunchHistoryTable from '../components/history/LaunchHistoryTable'
import LaunchDetailDrawer from '../components/history/LaunchDetailDrawer'
import ComparisonView from '../components/history/ComparisonView'
import SuccessRateChart from '../components/history/SuccessRateChart'
import PayloadScatterPlot from '../components/history/PayloadScatterPlot'
import ExportCitePanel from '../components/history/ExportCitePanel'

const DEFAULT_FILTERS = {
  outcome: '', agencies: [], rockets: [], orbits: [],
  date_from: '', date_to: '',
  payload_min: 0, payload_max: 65000,
}
const PAGE_SIZE = 50

function buildHistoryParams(filters, sorting) {
  const params = new URLSearchParams()
  if (filters.outcome)                  params.set('outcome', filters.outcome)
  if (filters.date_from)                params.set('date_from', filters.date_from)
  if (filters.date_to)                  params.set('date_to', filters.date_to)
  if ((filters.agencies || []).length)  params.set('agency', filters.agencies[0])
  if ((filters.rockets || []).length)   params.set('rocket', filters.rockets[0])
  if ((filters.orbits || []).length)    params.set('orbit', filters.orbits[0])
  if (sorting?.[0]) {
    params.set('sort', sorting[0].id)
    params.set('sort_desc', sorting[0].desc)
  }
  return params
}

async function fetchHistory({ filters, page, sorting }) {
  const params = buildHistoryParams(filters, sorting)
  params.set('page', page)
  params.set('limit', PAGE_SIZE)
  try {
    const { data } = await axios.get(`/api/launches/history?${params}`)
    return data
  } catch (err) {
    const body = err.response?.data
    const enriched = new Error(body?.message || err.message)
    enriched.isRateLimit = err.response?.status === 429 || body?.error === 'rate_limit'
    throw enriched
  }
}

async function fetchChartData({ filters, sorting }) {
  const params = buildHistoryParams(filters, sorting)
  try {
    const { data } = await axios.get(`/api/launches/history/chart?${params}`)
    return data
  } catch (err) {
    const body = err.response?.data
    const enriched = new Error(body?.message || err.message)
    enriched.isRateLimit = err.response?.status === 429 || body?.error === 'rate_limit'
    throw enriched
  }
}


function countActiveFilters(filters) {
  let n = 0
  if (filters.outcome) n++
  if ((filters.agencies || []).length) n++
  if ((filters.rockets || []).length) n++
  if ((filters.orbits || []).length) n++
  if (filters.date_from || filters.date_to) n++
  if (filters.payload_max < 65000 || filters.payload_min > 0) n++
  return n
}

// Client-side filter for payload range (LL2 doesn't filter by payload mass directly)
function applyPayloadFilter(launches, filters) {
  const { payload_min = 0, payload_max = 65000 } = filters
  if (payload_min === 0 && payload_max === 65000) return launches
  return (launches || []).filter(l => {
    const cap = l.rocket?.configuration?.leo_capacity
    if (cap == null) return true
    return cap >= payload_min && cap <= payload_max
  })
}

export default function History() {
  const [filters, setFilters]         = useState(DEFAULT_FILTERS)
  const [page, setPage]               = useState(1)
  const [sorting, setSorting]         = useState([{ id: 'net', desc: true }])
  const [rowSelection, setRowSelection] = useState({})
  const [drawerLaunch, setDrawerLaunch] = useState(null)
  const [chartsVisible, setChartsVisible] = useState(true)

  const { data, isLoading, isError, error, dataUpdatedAt } = useQuery({
    queryKey: ['history', filters, page, sorting],
    queryFn: () => fetchHistory({ filters, page, sorting }),
    keepPreviousData: true,
    staleTime: 30_000,
    retry: (count, err) => !err?.isRateLimit && count < 2,
  })

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['history-chart', filters, sorting],
    queryFn: () => fetchChartData({ filters, sorting }),
    staleTime: 60_000,
    retry: (count, err) => !err?.isRateLimit && count < 2,
    // Auto-retry every 60 s when the server returned partial data (rate-limited mid-fetch)
    refetchInterval: (data) => data?.partial ? 60_000 : false,
  })

  const isRateLimit = isError && error?.isRateLimit
  const { data: apiStatus } = useBudget()

  const launches = useMemo(
    () => applyPayloadFilter(data?.results, filters),
    [data?.results, filters]
  )

  const total    = data?.count ?? 0
  const fetchedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null

  // Comparison: collect selected launch objects from current page
  const selectedLaunches = useMemo(() => {
    const selectedIds = Object.keys(rowSelection)
    return (launches || []).filter(l => selectedIds.includes(l.id))
  }, [launches, rowSelection])

  function handleFilterChange(next) {
    setFilters(next)
    setPage(1)
    setRowSelection({})
  }

  function handleClearFilters() {
    setFilters(DEFAULT_FILTERS)
    setPage(1)
    setRowSelection({})
  }

  const handleRowClick = useCallback(launch => setDrawerLaunch(launch), [])

  const handleRemoveFromComparison = useCallback(id => {
    setRowSelection(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  // When scatter plot point clicked — find launch in current data and open drawer
  const handleScatterClick = useCallback(id => {
    const launch = (launches || []).find(l => l.id === id)
    if (launch) setDrawerLaunch(launch)
  }, [launches])

  const activeFilterCount = countActiveFilters(filters)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F0F4F8' }}>
      <NavBar />

      {/* Sub-header */}
      <div className="bg-white border-b border-[rgba(27,108,168,0.12)] px-4 py-1.5 flex items-center gap-3">
        <span className="text-[11px] font-mono text-gray-500">MODULE 2 · LAUNCH HISTORY & COMPARISON</span>
        <div className="ml-auto flex items-center gap-3 text-[10px] font-mono">
          {isLoading && (
            <span className="flex items-center gap-1 text-gray-500">
              <span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              Fetching…
            </span>
          )}
          {isError && !isRateLimit && <span className="text-red-500">API error</span>}
          <BudgetPill budget={apiStatus?.budget} />
          <span className={`px-1.5 py-0.5 rounded ${isError ? 'bg-red-100 text-red-600' : 'bg-accent/10 text-accent'}`}>
            {isError ? 'ERR' : isLoading ? 'LOADING' : `${total.toLocaleString()} launches`}
          </span>
          <button
            type="button"
            onClick={() => setChartsVisible(v => !v)}
            className="text-gray-500 hover:text-[#1A1F36] text-[10px] border border-accent/20 px-2 py-0.5 rounded hover:bg-gray-100"
          >
            {chartsVisible ? 'Hide Charts' : 'Show Charts'}
          </button>
        </div>
      </div>

      {/* Main layout: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filter sidebar */}
        <div className="shrink-0 overflow-y-auto bg-white border-r border-[rgba(27,108,168,0.12)]" style={{ width: 256 }}>
          <FilterPanel
            filters={filters}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
            activeCount={activeFilterCount}
          />
        </div>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          {isRateLimit && (
            <div className="panel p-4 font-mono text-sm text-center">
              <div className="text-amber-600 text-base mb-2">⚠ LL2 API Rate Limit Exceeded</div>
              <div className="text-gray-600 text-[12px] leading-relaxed">
                Anonymous access allows <strong className="text-[#1A1F36]">15 requests/hour</strong>.
                This page will automatically retry in <strong className="text-[#1A1F36]">~1 hour</strong>.
              </div>
              <div className="mt-2 text-[11px] text-gray-500">
                Add your SpaceDevs token to <code className="text-accent">VITE_LL2_API_KEY</code> in <code className="text-accent">.env</code> for 300 req/hr.
              </div>
            </div>
          )}
          {isError && !isRateLimit && (
            <div className="panel p-4 text-red-600 font-mono text-sm text-center">
              Failed to fetch launch history. Is the API server running on port 3001?
            </div>
          )}

          {/* Table */}
          <LaunchHistoryTable
            launches={launches}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            sorting={sorting}
            onSortChange={setSorting}
            onPageChange={setPage}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            onRowClick={handleRowClick}
          />

          {/* Comparison view (visible when 2+ launches selected) */}
          {selectedLaunches.length >= 2 && (
            <ComparisonView
              launches={selectedLaunches}
              onRemove={handleRemoveFromComparison}
            />
          )}
          {selectedLaunches.length === 1 && (
            <div className="panel p-3 text-center text-[11px] font-mono text-gray-500">
              Select 1 more launch (up to 5 total) to enable comparison view.
            </div>
          )}

          {/* Charts */}
          {chartsVisible && (
            <>
              <SuccessRateChart
                byYearAgency={chartData?.byYearAgency}
                fetchedAt={fetchedAt}
                loading={chartLoading}
                partial={chartData?.partial}
                fetched={chartData?.fetched}
                total={chartData?.total}
              />

              <PayloadScatterPlot
                payloadScatter={chartData?.payloadScatter}
                filters={filters}
                onPointClick={handleScatterClick}
                fetchedAt={fetchedAt}
                loading={chartLoading}
                partial={chartData?.partial}
              />
            </>
          )}

          {/* Citation & Export */}
          <ExportCitePanel
            filters={filters}
            fetchedAt={fetchedAt}
            launches={launches}
          />
        </main>
      </div>

      {/* Detail drawer */}
      <LaunchDetailDrawer
        launch={drawerLaunch}
        onClose={() => setDrawerLaunch(null)}
      />

      <footer className="border-t border-accent/20 px-4 py-2 flex items-center justify-between text-[9px] font-mono text-gray-600 shrink-0">
        <span>PROJECT DAEDALUS · MODULE 2 · HISTORY & COMPARISON</span>
        <span>Source: LL2 v2.2.0 · Page size: {PAGE_SIZE} · 60s cache</span>
      </footer>
    </div>
  )
}
