import { useEffect, useState } from 'react'
import { getQuote } from '@/api/dataProvider'
import type { Quote } from '@/types/market'
import { formatCurrency, formatPercent } from '@/utils/formatters'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { useMarketStore } from '@/store/useMarketStore'
import { useNavigate } from 'react-router-dom'

const INDICES = ['SPY', 'QQQ', 'DIA', 'IWM', 'VGK', 'EEM']
const INDEX_NAMES: Record<string, string> = {
  SPY: 'S&P 500',
  QQQ: 'NASDAQ 100',
  DIA: 'Dow Jones',
  IWM: 'Russell 2000',
  VGK: 'Europa',
  EEM: 'Schwellenländer',
}

export function MarketOverview() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const setCurrentSymbol = useMarketStore((s) => s.setCurrentSymbol)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all(INDICES.map(getQuote)).then(setQuotes)
  }, [])

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {quotes.map((q) => {
        const isPositive = q.changePercent >= 0
        return (
          <button
            key={q.symbol}
            onClick={() => { setCurrentSymbol(q.symbol); navigate('/chart') }}
            className="rounded-xl border border-gray-200 bg-white p-3 text-left transition-all hover:shadow-md dark:border-[var(--color-border-dark)] dark:bg-[var(--color-bg-card-dark)] dark:hover:bg-[var(--color-bg-hover-dark)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {INDEX_NAMES[q.symbol] || q.symbol}
              </span>
              {isPositive ? (
                <TrendingUp size={14} className="text-green-500" />
              ) : (
                <TrendingDown size={14} className="text-red-500" />
              )}
            </div>
            <div className="mt-1 text-lg font-bold dark:text-white">{formatCurrency(q.price)}</div>
            <div className={`text-sm font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {formatPercent(q.changePercent)}
            </div>
          </button>
        )
      })}
    </div>
  )
}
