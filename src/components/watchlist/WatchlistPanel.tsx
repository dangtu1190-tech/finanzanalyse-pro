import { useEffect } from 'react'
import { useWatchlistStore } from '@/store/useWatchlistStore'
import { useMarketStore } from '@/store/useMarketStore'
import { getQuote } from '@/api/dataProvider'
import { formatCurrency, formatPercent } from '@/utils/formatters'
import { X, TrendingUp, TrendingDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useNavigate } from 'react-router-dom'

export function WatchlistPanel() {
  const { symbols, quotes, setQuote, removeSymbol } = useWatchlistStore()
  const setCurrentSymbol = useMarketStore((s) => s.setCurrentSymbol)
  const navigate = useNavigate()

  useEffect(() => {
    symbols.forEach((symbol) => {
      getQuote(symbol).then((q) => setQuote(symbol, q))
    })
  }, [symbols, setQuote])

  function handleClick(symbol: string) {
    setCurrentSymbol(symbol)
    navigate('/chart')
  }

  return (
    <Card title="Watchlist">
      {symbols.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Watchlist ist leer. Suche Symbole über die Suchleiste.
        </div>
      ) : (
        <div className="space-y-1">
          {symbols.map((symbol) => {
            const q = quotes[symbol]
            const isPositive = q ? q.changePercent >= 0 : true
            return (
              <div
                key={symbol}
                className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-[var(--color-bg-hover-dark)] cursor-pointer"
                onClick={() => handleClick(symbol)}
              >
                <div className="flex items-center gap-2">
                  {isPositive ? (
                    <TrendingUp size={14} className="text-green-500" />
                  ) : (
                    <TrendingDown size={14} className="text-red-500" />
                  )}
                  <span className="text-sm font-semibold dark:text-white">{symbol}</span>
                </div>
                <div className="flex items-center gap-3">
                  {q && (
                    <>
                      <span className="text-sm dark:text-white">{formatCurrency(q.price)}</span>
                      <span className={`text-xs font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {formatPercent(q.changePercent)}
                      </span>
                    </>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSymbol(symbol) }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
