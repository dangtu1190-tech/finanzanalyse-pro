import { Tabs } from '@/components/ui/Tabs'
import { TIMEFRAMES, CHART_TYPES } from '@/config/constants'
import { useMarketStore } from '@/store/useMarketStore'
import type { Timeframe, ChartType } from '@/types/market'
import type { IndicatorType } from '@/types/indicators'

const indicatorOptions: { label: string; value: IndicatorType }[] = [
  { label: 'SMA', value: 'sma' },
  { label: 'EMA', value: 'ema' },
  { label: 'RSI', value: 'rsi' },
  { label: 'MACD', value: 'macd' },
  { label: 'BB', value: 'bollinger' },
  { label: 'Stoch', value: 'stochastic' },
  { label: 'ATR', value: 'atr' },
]

export function ChartToolbar() {
  const { timeframe, setTimeframe, chartType, setChartType, activeIndicators, toggleIndicator } = useMarketStore()

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Timeframe */}
      <Tabs
        tabs={TIMEFRAMES.map((t) => ({ label: t.label, value: t.value }))}
        active={timeframe}
        onChange={(v) => setTimeframe(v as Timeframe)}
        size="sm"
      />

      {/* Chart Type */}
      <Tabs
        tabs={CHART_TYPES.map((t) => ({ label: t.label, value: t.value }))}
        active={chartType}
        onChange={(v) => setChartType(v as ChartType)}
        size="sm"
      />

      {/* Indicators */}
      <div className="flex gap-1">
        {indicatorOptions.map((ind) => (
          <button
            key={ind.value}
            onClick={() => toggleIndicator(ind.value)}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              activeIndicators.includes(ind.value)
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {ind.label}
          </button>
        ))}
      </div>
    </div>
  )
}
