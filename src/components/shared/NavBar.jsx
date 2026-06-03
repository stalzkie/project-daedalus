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
    <nav className="bg-white border-b border-[rgba(0,0,0,0.07)] shadow-sm px-4 py-2 flex items-center gap-4 shrink-0">
      <div className="flex items-center gap-2 mr-4">
        <img src="/logo.png" alt="Project Daedalus" className="w-7 h-7 object-contain" />
        <span className="font-mono text-sm font-semibold text-[#1A1F36] tracking-wide">PROJECT DAEDALUS</span>
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
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'bg-accent/10 text-accent border border-accent/30'
                : 'text-gray-500 hover:text-[#1A1F36] hover:bg-gray-100'
            }`
          }
        >
          <span className="text-[11px]">{icon}</span>
          {label}
        </NavLink>
      ))}

      {moduleNum > 0 && (
        <div className="ml-auto text-[10px] font-mono text-gray-400">MODULE {moduleNum}</div>
      )}
    </nav>
  )
}
