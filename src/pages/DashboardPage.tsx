import { useMemo, useEffect } from 'react'
import { MarketOverview } from '@/components/market/MarketOverview'
import { WatchlistPanel } from '@/components/watchlist/WatchlistPanel'
import { Card } from '@/components/ui/Card'
import { generateSignals, getSignalColor, getSignalLabel } from '@/services/signals/signalEngine'
import { useWatchlistStore } from '@/store/useWatchlistStore'
import { useMarketStore } from '@/store/useMarketStore'
import { getHistoricalData } from '@/api/dataProvider'
import { useState } from 'react'
import type { SignalResult } from '@/types/indicators'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Activity, BarChart3 } from 'lucide-react'

export function DashboardPage() {
  const symbols = useWatchlistStore((s) => s.symbols)
  const setCurrentSymbol = useMarketStore((s) => s.setCurrentSymbol)
  const navigate = useNavigate()
  const [signals, setSignals] = useState<{ symbol: string; signal: SignalResult }[]>([])

  useEffect(() => {
    async function loadSignals() {
      const results = await Promise.all(
        symbols.slice(0, 8).map(async (symbol) => {
          const data = await getHistoricalData(symbol, '6M')
          return { symbol, signal: generateSignals(data) }
        })
      )
      setSignals(results.sort((a, b) => b.signal.confidence - a.signal.confidence))
    }
    loadSignals()
  }, [symbols])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 size={24} className="text-blue-500" />
        <h1 className="text-2xl font-bold dark:text-white">Marktübersicht</h1>
      </div>

      {/* Market Indices */}
      <MarketOverview />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Signals */}
        <Card title="Top Signale" action={
          <span className="text-xs text-gray-500 dark:text-gray-400">
            <Activity size={12} className="mr-1 inline" />
            Basierend auf 7 Indikatoren
          </span>
        }>
          <div className="space-y-2">
            {signals.map(({ symbol, signal }) => (
              <button
                key={symbol}
                onClick={() => { setCurrentSymbol(symbol); navigate('/chart') }}
                className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 transition-colors hover:bg-gray-100 dark:bg-[var(--color-bg-hover-dark)] dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} style={{ color: getSignalColor(signal.direction) }} />
                  <span className="text-sm font-semibold dark:text-white">{symbol}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${signal.confidence}%`,
                        backgroundColor: getSignalColor(signal.direction),
                      }}
                    />
                  </div>
                  <span
                    className="min-w-24 rounded-full px-2 py-0.5 text-center text-xs font-semibold text-white"
                    style={{ backgroundColor: getSignalColor(signal.direction) }}
                  >
                    {getSignalLabel(signal.direction)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Watchlist */}
        <WatchlistPanel />
      </div>
    </div>
  )
}
