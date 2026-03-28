import { useMarketData } from '@/hooks/useMarketData'
import { BacktestPanel } from '@/components/backtest/BacktestPanel'
import { FlaskConical } from 'lucide-react'
import { useMarketStore } from '@/store/useMarketStore'
import { Tabs } from '@/components/ui/Tabs'
import { TIMEFRAMES } from '@/config/constants'
import type { Timeframe } from '@/types/market'

export function BacktestPage() {
  useMarketData()
  const { currentSymbol, timeframe, setTimeframe } = useMarketStore()

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical size={24} className="text-blue-500" />
          <h1 className="text-2xl font-bold dark:text-white">Backtesting — {currentSymbol}</h1>
        </div>
        <Tabs
          tabs={TIMEFRAMES.filter(t => ['3M', '6M', '1Y', '5Y'].includes(t.value)).map(t => ({ label: t.label, value: t.value }))}
          active={timeframe}
          onChange={v => setTimeframe(v as Timeframe)}
          size="sm"
        />
      </div>

      <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
        Wähle eine Strategie und teste sie gegen historische Daten von {currentSymbol}.
        Vergleiche das Ergebnis mit Buy & Hold.
      </div>

      <BacktestPanel />
    </div>
  )
}
