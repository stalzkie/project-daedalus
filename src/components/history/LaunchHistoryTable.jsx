import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'

const columnHelper = createColumnHelper()

const STATUS_BADGE = {
  Success:           'bg-green-900/50 text-green-400 border-green-700',
  Failure:           'bg-red-900/50 text-red-400 border-red-700',
  'Partial Failure': 'bg-orange-900/50 text-orange-400 border-orange-700',
  Go:                'bg-green-900/50 text-green-400 border-green-700',
  Hold:              'bg-red-900/50 text-red-400 border-red-700',
  TBD:               'bg-gray-800 text-gray-400 border-gray-600',
}

function OutcomeBadge({ status }) {
  const s = STATUS_BADGE[status?.name] || STATUS_BADGE[status?.abbrev] || STATUS_BADGE.TBD
  return (
    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${s}`}>
      {status?.abbrev || '—'}
    </span>
  )
}

const ALL_COLUMNS = [
  { id: 'net',    label: 'NET Date',   visible: true },
  { id: 'name',   label: 'Mission',    visible: true },
  { id: 'rocket', label: 'Vehicle',    visible: true },
  { id: 'agency', label: 'Agency',     visible: true },
  { id: 'orbit',  label: 'Orbit',      visible: true },
  { id: 'payload',label: 'LEO Cap.',   visible: true },
  { id: 'status', label: 'Outcome',    visible: true },
]

export default function LaunchHistoryTable({
  launches, total, page, pageSize, sorting, onSortChange, onPageChange,
  rowSelection, onRowSelectionChange, onRowClick,
}) {
  const [colVisibility, setColVisibility] = useState(
    Object.fromEntries(ALL_COLUMNS.map(c => [c.id, c.visible]))
  )
  const [showColToggle, setShowColToggle] = useState(false)

  const pageCount = Math.ceil((total || 0) / pageSize)

  const columns = useMemo(() => [
    // Checkbox column
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          className="accent-accent"
          checked={table.getIsAllPageRowsSelected()}
          ref={el => { if (el) el.indeterminate = table.getIsSomePageRowsSelected() }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          onClick={e => e.stopPropagation()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="accent-accent"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          onClick={e => e.stopPropagation()}
        />
      ),
      size: 32,
      enableSorting: false,
    },

    columnHelper.accessor('net', {
      header: 'NET Date',
      cell: info => (
        <span className="font-mono text-[11px]">
          {info.getValue() ? new Date(info.getValue()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }) : '—'}
        </span>
      ),
      enableSorting: true,
    }),

    columnHelper.accessor('name', {
      header: 'Mission',
      cell: info => (
        <span className="text-[11px] font-medium text-white max-w-[220px] block truncate" title={info.getValue()}>
          {info.getValue() || '—'}
        </span>
      ),
      enableSorting: true,
    }),

    columnHelper.accessor(row => row.rocket?.configuration?.name, {
      id: 'rocket',
      header: 'Vehicle',
      cell: info => <span className="text-[11px] text-gray-300 font-mono">{info.getValue() || '—'}</span>,
      enableSorting: true,
    }),

    columnHelper.accessor(row => row.launch_service_provider?.name, {
      id: 'agency',
      header: 'Agency',
      cell: info => <span className="text-[11px] text-gray-300 max-w-[140px] block truncate">{info.getValue() || '—'}</span>,
      enableSorting: true,
    }),

    columnHelper.accessor(row => row.mission?.orbit?.abbrev, {
      id: 'orbit',
      header: 'Orbit',
      cell: info => (
        <span className="font-mono text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">
          {info.getValue() || '—'}
        </span>
      ),
      enableSorting: true,
    }),

    columnHelper.accessor(row => row.rocket?.configuration?.payload_leo_kg, {
      id: 'payload',
      header: 'LEO Cap. (kg)',
      cell: info => {
        const v = info.getValue()
        return <span className="font-mono text-[11px] text-gray-400">{v != null ? v.toLocaleString() : '—'}</span>
      },
      enableSorting: false,
    }),

    columnHelper.accessor('status', {
      id: 'status',
      header: 'Outcome',
      cell: info => <OutcomeBadge status={info.getValue()} />,
      enableSorting: true,
    }),
  ], [])

  const table = useReactTable({
    data: launches ?? [],
    columns,
    pageCount,
    state: {
      sorting,
      pagination: { pageIndex: page - 1, pageSize },
      rowSelection,
      columnVisibility: colVisibility,
    },
    onSortingChange: onSortChange,
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater({ pageIndex: page - 1, pageSize }) : updater
      onPageChange(next.pageIndex + 1)
    },
    onRowSelectionChange: onRowSelectionChange,
    onColumnVisibilityChange: setColVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: (row) => {
      const selectedCount = Object.keys(rowSelection).length
      return selectedCount < 5 || !!rowSelection[row.id]
    },
    getRowId: row => row.id,
  })

  const selectedCount = Object.keys(rowSelection).length

  return (
    <div className="panel flex flex-col">
      {/* Table toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-accent/20 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-accent tracking-widest uppercase">Launch History</span>
          <span className="text-[10px] font-mono text-gray-500">
            {total != null ? `${total.toLocaleString()} total` : '—'}
          </span>
          {selectedCount > 0 && (
            <span className="text-[10px] font-mono text-yellow-400">
              {selectedCount}/5 selected for comparison
            </span>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColToggle(s => !s)}
            className="text-[10px] font-mono text-gray-400 hover:text-white px-2 py-1 border border-accent/20 rounded hover:border-accent/50 transition-colors"
          >
            Columns ▾
          </button>
          {showColToggle && (
            <div className="absolute right-0 top-full mt-1 bg-navy-800 border border-accent/30 rounded p-2 z-10 min-w-[140px] shadow-xl"
                 style={{ background: '#0d2257' }}>
              {table.getAllLeafColumns().filter(c => c.id !== 'select').map(col => (
                <label key={col.id} className="flex items-center gap-2 py-0.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={col.getIsVisible()}
                    onChange={col.getToggleVisibilityHandler()}
                    className="accent-accent"
                  />
                  <span className="text-[11px] text-gray-300">{col.columnDef.header}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="border-b border-accent/20">
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-[9px] font-mono text-gray-500 uppercase tracking-widest whitespace-nowrap select-none"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={`flex items-center gap-1 ${header.column.getCanSort() ? 'cursor-pointer hover:text-white' : ''}`}
                        onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc'  && <span className="text-accent">↑</span>}
                        {header.column.getIsSorted() === 'desc' && <span className="text-accent">↓</span>}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                className={`border-b border-accent/10 cursor-pointer transition-colors
                  ${row.getIsSelected() ? 'bg-accent/10' : 'hover:bg-white/5'}`}
                onClick={() => onRowClick(row.original)}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {launches?.length === 0 && (
              <tr>
                <td colSpan={99} className="px-3 py-8 text-center text-gray-500 font-mono text-sm">
                  No launches match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-accent/20 shrink-0">
        <span className="text-[10px] font-mono text-gray-500">
          Page {page} of {pageCount || 1} · {launches?.length ?? 0} rows
        </span>
        <div className="flex items-center gap-1">
          {[
            { label: '«', action: () => onPageChange(1),        disabled: page <= 1 },
            { label: '‹', action: () => onPageChange(page - 1), disabled: page <= 1 },
            { label: '›', action: () => onPageChange(page + 1), disabled: page >= pageCount },
            { label: '»', action: () => onPageChange(pageCount),disabled: page >= pageCount },
          ].map(btn => (
            <button
              key={btn.label}
              type="button"
              onClick={btn.action}
              disabled={btn.disabled}
              className="w-7 h-7 flex items-center justify-center font-mono text-[12px] rounded border border-accent/20 text-gray-400 hover:text-white hover:border-accent/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
