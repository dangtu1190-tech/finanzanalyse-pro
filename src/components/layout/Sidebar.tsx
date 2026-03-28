import { clsx } from 'clsx'
import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, LineChart, Briefcase, PieChart, Settings, TrendingUp, FlaskConical, Menu, X } from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/chart', icon: LineChart, label: 'Chart-Analyse' },
  { path: '/backtest', icon: FlaskConical, label: 'Backtesting' },
  { path: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { path: '/sectors', icon: PieChart, label: 'Sektoren' },
  { path: '/settings', icon: Settings, label: 'Einstellungen' },
]

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleNav(path: string) {
    navigate(path)
    setMobileOpen(false)
  }

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 rounded-lg bg-white p-2 shadow-md lg:hidden dark:bg-[var(--color-bg-card-dark)]"
      >
        {mobileOpen ? <X size={20} className="dark:text-white" /> : <Menu size={20} className="dark:text-white" />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed z-40 flex h-screen flex-col border-r border-gray-200 bg-white py-4 transition-transform dark:border-[var(--color-border-dark)] dark:bg-[var(--color-bg-card-dark)]',
        'w-56 px-3',
        'lg:static lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
            <TrendingUp size={20} className="text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
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
                onClick={() => handleNav(item.path)}
                className={clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[var(--color-bg-hover-dark)]'
                )}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
