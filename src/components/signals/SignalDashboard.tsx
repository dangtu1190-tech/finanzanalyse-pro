import { useMemo } from 'react'
import { useMarketStore } from '@/store/useMarketStore'
import { generateSignals, getSignalColor, getSignalLabel } from '@/services/signals/signalEngine'
import { Card } from '@/components/ui/Card'
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react'

export function SignalDashboard() {
  const ohlcv = useMarketStore((s) => s.ohlcv)
  const currentSymbol = useMarketStore((s) => s.currentSymbol)

  const signal = useMemo(() => generateSignals(ohlcv), [ohlcv])

  const directionIcon = {
    STRONG_BUY: <TrendingUp className="text-green-500" size={24} />,
    BUY: <TrendingUp className="text-green-400" size={24} />,
    HOLD: <Minus className="text-yellow-500" size={24} />,
    SELL: <TrendingDown className="text-red-400" size={24} />,
    STRONG_SELL: <TrendingDown className="text-red-500" size={24} />,
  }

  return (
    <div className="space-y-3">
      {/* Main Signal */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Signal für {currentSymbol}</div>
            <div className="mt-1 flex items-center gap-2">
              {directionIcon[signal.direction]}
              <span
                className="text-xl font-bold"
                style={{ color: getSignalColor(signal.direction) }}
              >
                {getSignalLabel(signal.direction)}
              </span>
            </div>
          </div>

          {/* Confidence Gauge */}
          <div className="text-center">
            <div className="relative h-16 w-16">
              <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" className="dark:stroke-gray-700" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={getSignalColor(signal.direction)}
                  strokeWidth="3"
                  strokeDasharray={`${signal.confidence} ${100 - signal.confidence}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold dark:text-white">{signal.confidence}%</span>
              </div>
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Konfidenz</div>
          </div>
        </div>
      </Card>

      {/* Individual Indicator Signals */}
      <Card title="Indikator-Analyse">
        <div className="space-y-2">
          {signal.indicators.map((ind) => (
            <div
              key={ind.name}
              className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-[var(--color-bg-hover-dark)]"
            >
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-gray-400" />
                <span className="text-sm font-medium dark:text-white">{ind.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400 max-w-48 truncate">
                  {ind.reason}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    ind.signal === 'BUY'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : ind.signal === 'SELL'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {ind.signal === 'BUY' ? 'Kauf' : ind.signal === 'SELL' ? 'Verkauf' : 'Neutral'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
