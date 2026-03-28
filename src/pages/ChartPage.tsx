import { useMarketData } from '@/hooks/useMarketData'
import { QuoteHeader } from '@/components/market/QuoteHeader'
import { ChartContainer } from '@/components/chart/ChartContainer'
import { SignalDashboard } from '@/components/signals/SignalDashboard'
import { AnalystReport } from '@/components/analysis/AnalystReport'
import { NewsFeed } from '@/components/news/NewsFeed'
import { AlertPanel } from '@/components/alerts/AlertPanel'
import { LineChart } from 'lucide-react'
import { useMarketStore } from '@/store/useMarketStore'
import { useState } from 'react'

type RightTab = 'signals' | 'analysis' | 'news' | 'alerts'

export function ChartPage() {
  useMarketData()
  const currentSymbol = useMarketStore((s) => s.currentSymbol)
  const [rightTab, setRightTab] = useState<RightTab>('analysis')

  const tabs: { label: string; value: RightTab }[] = [
    { label: 'KI-Analyse', value: 'analysis' },
    { label: 'Signale', value: 'signals' },
    { label: 'News', value: 'news' },
    { label: 'Alerts', value: 'alerts' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <LineChart size={24} className="text-blue-500" />
        <h1 className="text-2xl font-bold dark:text-white">Chart-Analyse — {currentSymbol}</h1>
      </div>

      <QuoteHeader />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        {/* Main Chart */}
        <ChartContainer />

        {/* Right Panel */}
        <div className="space-y-3">
          {/* Tab Switcher */}
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {tabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => setRightTab(tab.value)}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  rightTab === tab.value
                    ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {rightTab === 'analysis' && <AnalystReport />}
          {rightTab === 'signals' && <SignalDashboard />}
          {rightTab === 'news' && <NewsFeed symbol={currentSymbol} />}
          {rightTab === 'alerts' && <AlertPanel />}
        </div>
      </div>
    </div>
  )
}
