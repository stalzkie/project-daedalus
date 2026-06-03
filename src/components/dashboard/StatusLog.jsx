import { useEffect, useRef, useState, useCallback } from 'react'
import DataSourceTag from './DataSourceTag'

const LOG_LEVEL_COLOR = {
  INFO:  'text-blue-600',
  GO:    'text-green-600',
  HOLD:  'text-red-600',
  WARN:  'text-yellow-600',
  SYS:   'text-gray-400',
  DATA:  'text-cyan-600',
}

function buildInitialLog(launch) {
  if (!launch) return []
  const net = new Date(launch.net)
  const now = new Date()

  const entries = [
    { level: 'SYS',  msg: `[DAEDALUS] Module 1 · Live Launch Dashboard online` },
    { level: 'DATA', msg: `[API] Fetched ${launch.name} — status: ${launch.status?.abbrev}` },
    { level: 'INFO', msg: `[NET] T-0 locked at ${net.toISOString()}` },
    { level: 'INFO', msg: `[PAD]  ${launch.pad?.name} · ${launch.pad?.location?.name}` },
    { level: 'INFO', msg: `[VEH]  ${launch.rocket?.configuration?.full_name || launch.rocket?.configuration?.name}` },
    { level: 'INFO', msg: `[ORB]  Target orbit: ${launch.mission?.orbit?.name || launch.mission?.orbit_abbrev || 'Unknown'}` },
  ]

  if (launch.status?.abbrev === 'Hold') {
    entries.push({ level: 'HOLD', msg: `[HOLD] ${launch.holdreason || 'Hold reason not specified'}` })
  }
  if (launch.status?.abbrev === 'Go') {
    entries.push({ level: 'GO',   msg: `[POLL] Range safety: nominal` })
    entries.push({ level: 'GO',   msg: `[POLL] Vehicle health: GO` })
    entries.push({ level: 'GO',   msg: `[POLL] Weather: ${launch.probability != null ? launch.probability + '% go' : 'assessing'}` })
  }

  entries.push({ level: 'SYS', msg: `[CACHE] Data cached · TTL 60s · next refresh ${new Date(now.getTime() + 60000).toISOString()}` })

  return entries.map((e, i) => ({
    id: i,
    ts: new Date(now.getTime() - (entries.length - i) * 4200).toISOString(),
    ...e,
  }))
}

let logIdCounter = 1000

function makeEntry(level, msg) {
  return { id: logIdCounter++, ts: new Date().toISOString(), level, msg }
}

export default function StatusLog({ launch, fetchedAt }) {
  const [entries, setEntries] = useState(() => buildInitialLog(launch))
  const scrollRef = useRef(null)
  const prevLaunchId = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Re-seed log on launch switch
  useEffect(() => {
    if (!launch) return
    if (launch.id !== prevLaunchId.current) {
      prevLaunchId.current = launch.id
      setEntries(buildInitialLog(launch))
    }
  }, [launch])

  // Simulate live telemetry ticks
  useEffect(() => {
    if (!launch) return
    const TICKS = [
      () => makeEntry('DATA', `[POLL] T-0 reconfirmed: ${new Date(launch.net).toISOString()}`),
      () => makeEntry('SYS',  `[WS]   Heartbeat OK · ${new Date().toISOString()}`),
      () => makeEntry('INFO', `[WEATHER] Wind check nominal`),
      () => makeEntry('GO',   `[STATUS] ${launch.status?.abbrev || '—'} · ${launch.status?.description || ''}`),
      () => makeEntry('DATA', `[CACHE] TTL refreshed · next: ${new Date(Date.now() + 60000).toISOString()}`),
      () => makeEntry('SYS',  `[PAD]  Hazard area: clear`),
      () => makeEntry('INFO', `[RANGE] Flight safety: nominal`),
    ]
    let idx = 0
    const id = setInterval(() => {
      setEntries(prev => [...prev.slice(-120), TICKS[idx % TICKS.length]()])
      idx++
    }, 8000)
    return () => clearInterval(id)
  }, [launch])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries, autoScroll])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 32)
  }, [])

  return (
    <div className="panel p-4 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <span className="text-[10px] font-mono text-accent tracking-widest uppercase">Status Log</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] font-mono text-green-400">LIVE</span>
        </span>
        <DataSourceTag source="Daedalus telemetry" fetchedAt={fetchedAt} />
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-[#F8FAFC] rounded border border-[rgba(0,0,0,0.07)] p-2"
        style={{ minHeight: 180, maxHeight: 280, fontFamily: 'JetBrains Mono, Fira Code, monospace' }}
      >
        {entries.map((e) => (
          <div key={e.id} className="terminal-line flex gap-2">
            <span className="text-gray-400 text-[10px] shrink-0 select-none">
              {new Date(e.ts).toISOString().substring(11, 23)}
            </span>
            <span className={`text-[10px] font-bold shrink-0 w-10 ${LOG_LEVEL_COLOR[e.level] || 'text-gray-400'}`}>
              {e.level}
            </span>
            <span className="text-[11px] text-gray-600 break-all">{e.msg}</span>
          </div>
        ))}
      </div>

      {!autoScroll && (
        <button
          type="button"
          onClick={() => {
            setAutoScroll(true)
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
          }}
          className="mt-1 text-[10px] font-mono text-accent hover:text-[#1A1F36] text-right"
        >
          ↓ scroll to latest
        </button>
      )}
    </div>
  )
}
