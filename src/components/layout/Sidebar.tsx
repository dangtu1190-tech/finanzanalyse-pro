import { clsx } from 'clsx'
import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, LineChart, Briefcase, PieChart, Settings, TrendingUp } from 'lucide-react'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/chart', icon: LineChart, label: 'Chart-Analyse' },
  { path: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { path: '/sectors', icon: PieChart, label: 'Sektoren' },
  { path: '/settings', icon: Settings, label: 'Einstellungen' },
]

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <aside className="flex h-screen w-16 flex-col items-center border-r border-gray-200 bg-white py-4 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-bg-card-dark)] lg:w-56 lg:items-start lg:px-3">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
          <TrendingUp size={20} className="text-white" />
        </div>
        <span className="hidden text-lg font-bold text-gray-900 dark:text-white lg:block">
          FinanzPro
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 w-full">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                'justify-center lg:justify-start',
                isActive
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[var(--color-bg-hover-dark)]'
              )}
            >
              <item.icon size={20} />
              <span className="hidden lg:block">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
