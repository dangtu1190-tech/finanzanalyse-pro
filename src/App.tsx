import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/pages/DashboardPage'
import { ChartPage } from '@/pages/ChartPage'
import { BacktestPage } from '@/pages/BacktestPage'
import { AutoTraderPage } from '@/pages/AutoTraderPage'
import { PortfolioPage } from '@/pages/PortfolioPage'
import { SectorPage } from '@/pages/SectorPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { I18nProvider } from '@/i18n'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useEffect } from 'react'

export default function App() {
  const language = useSettingsStore((s) => s.language)
  const theme = useSettingsStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <I18nProvider value={language}>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/chart" element={<ChartPage />} />
            <Route path="/autotrader" element={<AutoTraderPage />} />
            <Route path="/backtest" element={<BacktestPage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/sectors" element={<SectorPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </I18nProvider>
  )
}
