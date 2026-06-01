import { NavLink, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/',           label: 'Dashboard',   icon: '◎' },
  { to: '/history',    label: 'History',     icon: '⧖' },
  { to: '/calculator', label: 'Calculator',  icon: '∑' },
  { to: '/failures',   label: 'Failures',    icon: '✕', red: true },
]

export default function NavBar() {
  const { pathname } = useLocation()
  const moduleNum = NAV_ITEMS.findIndex(n =>
    n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)
  ) + 1

  return (
    <nav className="border-b border-accent/30 px-4 py-2 flex items-center gap-4 shrink-0">
      <div className="flex items-center gap-2 mr-4">
        <div className="w-6 h-6 rounded bg-accent flex items-center justify-center text-[10px] font-bold text-white">D</div>
        <span className="font-mono text-sm font-semibold text-white tracking-wide">PROJECT DAEDALUS</span>
      </div>

      {NAV_ITEMS.map(({ to, label, icon, red }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-1 rounded text-[12px] font-mono transition-colors ${
              isActive
                ? red
                  ? 'bg-red-700/20 text-red-500 border border-red-700/40'
                  : 'bg-accent/20 text-accent border border-accent/40'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`
          }
        >
          <span className="text-[11px]">{icon}</span>
          {label}
        </NavLink>
      ))}

      {moduleNum > 0 && (
        <div className="ml-auto text-[10px] font-mono text-gray-600">MODULE {moduleNum}</div>
      )}
    </nav>
  )
}
