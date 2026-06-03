import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useLaunchSocket } from '../hooks/useLaunchSocket'
import NavBar from '../components/shared/NavBar'
import { useBudget } from '../hooks/useBudget'
import BudgetPill from '../components/shared/BudgetPill'
import LaunchStrip from '../components/dashboard/LaunchStrip'
import NextLaunchCard from '../components/dashboard/NextLaunchCard'
import VehicleSpecs from '../components/dashboard/VehicleSpecs'
import LaunchSiteMap from '../components/dashboard/LaunchSiteMap'
import StatusLog from '../components/dashboard/StatusLog'
import WeatherWidget from '../components/dashboard/WeatherWidget'

async function fetchLaunches() {
  try {
    const { data } = await axios.get('/api/launches/upcoming')
    return data
  } catch (err) {
    const body = err.response?.data
    const enriched = new Error(body?.message || err.message)
    enriched.isRateLimit = err.response?.status === 429 || body?.error === 'rate_limit'
    enriched.retryAfter  = body?.retryAfter ?? 3600
    throw enriched
  }
}

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState(null)
  const [wsConnected, setWsConnected] = useState(false)

  const { data, isLoading, isError, error, dataUpdatedAt } = useQuery({
    queryKey: ['launches'],
    queryFn: fetchLaunches,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: (count, err) => !err?.isRateLimit && count < 2,
  })

  const isRateLimit = isError && error?.isRateLimit
  const { data: apiStatus } = useBudget()

  // WebSocket — pushes updates into React Query cache; falls back to polling above
  const handleWsUpdate = useCallback((wsData) => {
    setWsConnected(true)
    queryClient.setQueryData(['launches'], (old) => ({
      ...(old || {}),
      ...wsData,
      _meta: { ...(old?._meta || {}), fetchedAt: new Date().toISOString(), source: 'WebSocket push' },
    }))
  }, [queryClient])

  useLaunchSocket(handleWsUpdate)

  const launches = data?.results || []
  const fetchedAt = data?._meta?.fetchedAt || (dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null)

  const activeLaunch = selectedId
    ? launches.find(l => l.id === selectedId) || launches[0]
    : launches[0]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F0F4F8' }}>
      <NavBar />
      {/* Status bar */}
      <header className="border-b border-accent/20 px-4 py-1.5 flex items-center justify-between">
        <span className="text-gray-500 text-[11px] font-mono">MODULE 1 · LIVE LAUNCH DASHBOARD</span>

        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className={`flex items-center gap-1 ${wsConnected ? 'text-green-400' : 'text-gray-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
            {wsConnected ? 'WS' : 'POLL'}
          </span>
          <span className="text-gray-600">{fetchedAt ? new Date(fetchedAt).toLocaleTimeString('en-US', { hour12: false }) : '—'}</span>
          <BudgetPill budget={apiStatus?.budget} />
          <span className={`px-1.5 py-0.5 rounded ${
            isRateLimit ? 'bg-yellow-900/50 text-yellow-400' :
            isError     ? 'bg-red-900/50 text-red-400' :
                          'bg-accent/20 text-accent'
          }`}>
            {isRateLimit ? '429' : isError ? 'ERR' : isLoading ? 'LOADING' : 'NOMINAL'}
          </span>
        </div>
      </header>

      <main className="p-4 space-y-4 max-w-screen-2xl mx-auto">
        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <div className="font-mono text-sm text-gray-400">Fetching launch manifest…</div>
          </div>
        )}

        {isRateLimit && (
          <div className="panel p-4 text-center font-mono text-sm border-yellow-600/40">
            <div className="text-yellow-400 text-base mb-2">⚠ LL2 API Rate Limit Exceeded</div>
            <div className="text-gray-600 text-[12px] leading-relaxed max-w-xl mx-auto">
              The anonymous Launch Library 2 API allows <strong className="text-[#1A1F36]">15 requests/hour</strong>.
              The dashboard will automatically retry in <strong className="text-[#1A1F36]">~1 hour</strong>.
            </div>
            <div className="mt-3 text-[11px] text-gray-500">
              To increase the limit to 300 req/hr, add your SpaceDevs token to{' '}
              <code className="text-accent">VITE_LL2_API_KEY</code> in <code className="text-accent">.env</code>
            </div>
          </div>
        )}
        {isError && !isRateLimit && (
          <div className="panel p-4 text-center text-red-400 font-mono text-sm">
            Failed to fetch launch data. Is the API server running on port 3001?
          </div>
        )}

        {!isLoading && !isError && launches.length > 0 && (
          <>
            {/* 1 · Launch Strip */}
            <LaunchStrip
              launches={launches}
              activeId={activeLaunch?.id}
              onSelect={setSelectedId}
              fetchedAt={fetchedAt}
            />

            {activeLaunch && (
              <>
                {/* 2 · Next Launch Card (full width) */}
                <NextLaunchCard launch={activeLaunch} fetchedAt={fetchedAt} />

                {/* 3+4 · Vehicle Specs + Launch Site Map */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <VehicleSpecs launch={activeLaunch} fetchedAt={fetchedAt} />
                  <LaunchSiteMap launch={activeLaunch} fetchedAt={fetchedAt} />
                </div>

                {/* 5+6 · Status Log + Weather */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <StatusLog launch={activeLaunch} fetchedAt={fetchedAt} />
                  <WeatherWidget launch={activeLaunch} fetchedAt={fetchedAt} />
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-accent/20 px-4 py-2 mt-8 flex items-center justify-between text-[9px] font-mono text-gray-600">
        <span>PROJECT DAEDALUS · MODULE 1</span>
        <span>Data: LL2 v2.2.0 · Weather: Open-Meteo · Refresh: 60s</span>
      </footer>
    </div>
  )
}
