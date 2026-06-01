import { useMemo, useState, useCallback } from 'react'
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getPaginationRowModel, flexRender, createColumnHelper,
} from '@tanstack/react-table'
import Fuse from 'fuse.js'
import FailureFilterPanel from './FailureFilterPanel'
import { STAGE_COLORS } from './FailureTaxonomyChart'

const PAGE_SIZE = 25

const DEFAULT_FILTERS = {
  severity: '', stages: [], agencies: [],
  rudOnly: false, ftsOnly: false,
  decadeMin: 1950, decadeMax: 2020,
}

// ─── Empty state ──────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <tr>
      <td colSpan={99} className="py-16 text-center">
        <svg width="64" height="64" viewBox="0 0 64 64" className="mx-auto mb-3 opacity-30" fill="none">
          <path d="M32 8 L38 20 L52 20 L41 29 L45 43 L32 35 L19 43 L23 29 L12 20 L26 20 Z"
                fill="#B91C1C" opacity="0.5" />
          <line x1="20" y1="44" x2="44" y2="56" stroke="#B91C1C" strokeWidth="3" strokeLinecap="round" />
          <line x1="44" y1="44" x2="20" y2="56" stroke="#B91C1C" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <div className="text-gray-500 font-mono text-sm">No failures match your filters.</div>
        <div className="text-gray-600 font-mono text-[10px] mt-1">Try clearing some filters above.</div>
      </td>
    </tr>
  )
}

// ─── Badges ────────────────────────────────────────────────────────────────

function SeverityBadge({ severity }) {
  const styles = {
    total:   'bg-red-900/50 text-red-400 border-red-700',
    partial: 'bg-amber-900/50 text-amber-400 border-amber-700',
  }
  const labels = { total: 'Total Loss', partial: 'Partial' }
  const s = styles[severity] || 'bg-gray-800 text-gray-400 border-gray-600'
  return (
    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${s}`}>
      {labels[severity] || '—'}
    </span>
  )
}

function StagePill({ stage }) {
  const color = STAGE_COLORS[stage] || '#6B7280'
  return (
    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border"
          style={{ borderColor: color + '60', color, background: color + '18' }}>
      {stage?.split(' / ')[0] || '—'}
    </span>
  )
}

// ─── Column definition ────────────────────────────────────────────────────

const colHelper = createColumnHelper()

const columns = [
  colHelper.accessor('net', {
    header: 'Date',
    cell: i => (
      <span className="font-mono text-[11px] text-gray-300 whitespace-nowrap">
        {i.getValue() ? new Date(i.getValue()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }) : '—'}
      </span>
    ),
    enableSorting: true,
  }),
  colHelper.accessor('name', {
    header: 'Mission',
    cell: i => (
      <span className="text-[11px] font-medium text-white max-w-[200px] block truncate" title={i.getValue()}>
        {i.getValue() || '—'}
      </span>
    ),
    enableSorting: true,
  }),
  colHelper.accessor(r => r.rocket?.configuration?.family, {
    id: 'family',
    header: 'Rocket Family',
    cell: i => <span className="text-[11px] text-gray-300 font-mono">{i.getValue() || '—'}</span>,
    enableSorting: true,
  }),
  colHelper.accessor(r => r.launch_service_provider?.abbrev || r.launch_service_provider?.name, {
    id: 'agency',
    header: 'Agency',
    cell: i => <span className="text-[11px] text-gray-300 max-w-[100px] block truncate">{i.getValue() || '—'}</span>,
    enableSorting: true,
  }),
  colHelper.accessor(r => r.failureProfile?.stage, {
    id: 'stage',
    header: 'Failure Stage',
    cell: i => <StagePill stage={i.getValue()} />,
    enableSorting: true,
  }),
  colHelper.accessor(r => r.failureProfile?.severity, {
    id: 'severity',
    header: 'Severity',
    cell: i => <SeverityBadge severity={i.getValue()} />,
    enableSorting: true,
  }),
  colHelper.accessor(r => r.failureProfile?.isRUD, {
    id: 'rud',
    header: 'RUD',
    cell: i => i.getValue() ? (
      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded text-white"
            style={{ background: '#991B1B' }}>
        🔥 RUD
      </span>
    ) : null,
    enableSorting: false,
  }),
  colHelper.accessor(r => r.failureProfile?.isFTS, {
    id: 'fts',
    header: 'FTS',
    cell: i => i.getValue() ? (
      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded text-white"
            style={{ background: '#B45309' }}>
        ⚠ FTS
      </span>
    ) : null,
    enableSorting: false,
  }),
]

// ─── Main component ───────────────────────────────────────────────────────

export default function FailureSearchTable({ failures, isLoading, fetchedAt, onRowClick }) {
  const [filters,     setFilters]     = useState(DEFAULT_FILTERS)
  const [searchText,  setSearchText]  = useState('')
  const [sorting,     setSorting]     = useState([{ id: 'net', desc: true }])
  const [pagination,  setPagination]  = useState({ pageIndex: 0, pageSize: PAGE_SIZE })

  // Unique agencies derived from data
  const agencies = useMemo(() => {
    const set = new Set()
    ;(failures || []).forEach(f => {
      const a = f.launch_service_provider?.abbrev || f.launch_service_provider?.name
      if (a) set.add(a)
    })
    return [...set].sort()
  }, [failures])

  // fuse.js search index
  const fuse = useMemo(() => new Fuse(failures || [], {
    keys: ['name', 'failreason', 'mission.description'],
    threshold: 0.35,
    includeScore: true,
  }), [failures])

  // Apply text search
  const searchedFailures = useMemo(() => {
    if (!searchText.trim()) return failures || []
    return fuse.search(searchText).map(r => r.item)
  }, [fuse, searchText, failures])

  // Apply panel filters
  const filteredFailures = useMemo(() => {
    return searchedFailures.filter(f => {
      const fp = f.failureProfile
      if (filters.severity && fp.severity !== filters.severity) return false
      if (filters.rudOnly && !fp.isRUD) return false
      if (filters.ftsOnly && !fp.isFTS) return false
      if (filters.stages?.length && !filters.stages.includes(fp.stage)) return false
      if (filters.agencies?.length) {
        const a = f.launch_service_provider?.abbrev || f.launch_service_provider?.name || ''
        if (!filters.agencies.includes(a)) return false
      }
      const year = new Date(f.net).getFullYear()
      if (!isNaN(year)) {
        const decade = Math.floor(year / 10) * 10
        if (decade < (filters.decadeMin ?? 1950) || decade > (filters.decadeMax ?? 2020)) return false
      }
      return true
    })
  }, [searchedFailures, filters])

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (filters.severity) n++
    if (filters.rudOnly) n++
    if (filters.ftsOnly) n++
    if (filters.stages?.length) n++
    if (filters.agencies?.length) n++
    if (filters.decadeMin !== 1950 || filters.decadeMax !== 2020) n++
    return n
  }, [filters])

  const handleFilterChange = useCallback(next => {
    setFilters(next)
    setPagination(p => ({ ...p, pageIndex: 0 }))
  }, [])

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    setSearchText('')
    setPagination(p => ({ ...p, pageIndex: 0 }))
  }, [])

  const table = useReactTable({
    data: filteredFailures,
    columns,
    state: { sorting, pagination },
    onSortingChange: next => {
      setSorting(next)
      setPagination(p => ({ ...p, pageIndex: 0 }))
    },
    onPaginationChange: setPagination,
    getCoreRowModel:       getCoreRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: r => r.id,
  })

  const pageCount = table.getPageCount()
  const page      = pagination.pageIndex + 1

  return (
    <div className="panel flex flex-col" style={{ minHeight: 480 }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b shrink-0"
           style={{ borderColor: 'rgba(185,28,28,0.2)' }}>
        <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#B91C1C' }}>
          Failure Records
        </span>
        <div className="flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Search missions, failure reasons…"
            value={searchText}
            onChange={e => { setSearchText(e.target.value); setPagination(p => ({ ...p, pageIndex: 0 })) }}
            className="w-full text-[11px] font-mono px-3 py-1.5 rounded border text-white placeholder-gray-600 focus:outline-none"
            style={{ background: 'rgba(13,34,87,0.8)', borderColor: 'rgba(185,28,28,0.35)' }}
          />
        </div>
        {isLoading && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-gray-500">
            <span className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: '#B91C1C', borderTopColor: 'transparent' }} />
            Loading…
          </span>
        )}
        <span className="ml-auto text-[10px] font-mono text-gray-500">
          {filteredFailures.length.toLocaleString()} result{filteredFailures.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Filter sidebar */}
        <FailureFilterPanel
          filters={filters}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
          activeCount={activeFilterCount}
          agencies={agencies}
        />

        {/* Table area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id} className="border-b" style={{ borderColor: 'rgba(185,28,28,0.2)' }}>
                    {hg.headers.map(header => (
                      <th
                        key={header.id}
                        className="px-3 py-2 text-[9px] font-mono text-gray-500 uppercase tracking-widest whitespace-nowrap select-none"
                      >
                        <div
                          className={`flex items-center gap-1 ${header.column.getCanSort() ? 'cursor-pointer hover:text-white' : ''}`}
                          onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc'  && <span style={{ color: '#B91C1C' }}>↑</span>}
                          {header.column.getIsSorted() === 'desc' && <span style={{ color: '#B91C1C' }}>↓</span>}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? <EmptyState /> : (
                  table.getRowModel().rows.map(row => {
                    const isPartial = row.original.failureProfile?.isPartial
                    return (
                      <tr
                        key={row.id}
                        onClick={() => onRowClick?.(row.original)}
                        className="border-b cursor-pointer transition-colors hover:bg-red-950/20"
                        style={{
                          borderColor: 'rgba(185,28,28,0.1)',
                          borderLeft: isPartial ? '2px solid #D97706' : '2px solid transparent',
                        }}
                      >
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} className="px-3 py-2">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-3 py-2 border-t shrink-0"
               style={{ borderColor: 'rgba(185,28,28,0.2)' }}>
            <span className="text-[10px] font-mono text-gray-500">
              Page {page} of {pageCount || 1} · {table.getRowModel().rows.length} rows shown
            </span>
            <div className="flex items-center gap-1">
              {[
                { label: '«', fn: () => table.setPageIndex(0),                    disabled: !table.getCanPreviousPage() },
                { label: '‹', fn: () => table.previousPage(),                     disabled: !table.getCanPreviousPage() },
                { label: '›', fn: () => table.nextPage(),                         disabled: !table.getCanNextPage()     },
                { label: '»', fn: () => table.setPageIndex(pageCount - 1),        disabled: !table.getCanNextPage()     },
              ].map(btn => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={btn.fn}
                  disabled={btn.disabled}
                  className="w-7 h-7 flex items-center justify-center font-mono text-[12px] rounded border text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ borderColor: 'rgba(185,28,28,0.25)' }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
