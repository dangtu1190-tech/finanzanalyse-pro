import { useMarketStore } from '@/store/useMarketStore'
import { useWatchlistStore } from '@/store/useWatchlistStore'
import { formatCurrency, formatPercent, formatVolume } from '@/utils/formatters'
import { Star, StarOff, Wifi, WifiOff, Database } from 'lucide-react'
import { Card } from '@/components/ui/Card'

const sourceConfig = {
  yahoo: { label: 'Yahoo Finance', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', icon: Wifi },
  alphavantage: { label: 'Alpha Vantage', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: Database },
  demo: { label: 'Demo-Daten', color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', icon: WifiOff },
}

export function QuoteHeader() {
  const quote = useMarketStore((s) => s.quote)
  const currentSymbol = useMarketStore((s) => s.currentSymbol)
  const dataSource = useMarketStore((s) => s.dataSource)
  const { isWatching, addSymbol, removeSymbol } = useWatchlistStore()

  if (!quote) return null

  const isPositive = quote.change >= 0
  const watching = isWatching(currentSymbol)
  const source = sourceConfig[dataSource]
  const SourceIcon = source.icon

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold dark:text-white">{quote.symbol}</h2>
            <button
              onClick={() => watching ? removeSymbol(currentSymbol) : addSymbol(currentSymbol)}
              className="text-gray-400 hover:text-yellow-500"
            >
              {watching ? <Star size={20} fill="#f59e0b" color="#f59e0b" /> : <StarOff size={20} />}
            </button>
            {/* Data Source Badge */}
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${source.bg} ${source.color}`}>
              <SourceIcon size={12} />
              <span>{source.label}</span>
            </div>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{quote.name}</div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold dark:text-white">{formatCurrency(quote.price)}</div>
          <div className={`text-sm font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{formatCurrency(quote.change)} ({formatPercent(quote.changePercent)})
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div className="mt-4 grid grid-cols-4 gap-4 border-t border-gray-100 pt-3 dark:border-gray-800 lg:grid-cols-8">
        <Stat label="Eröffnung" value={formatCurrency(quote.open)} />
        <Stat label="Hoch" value={formatCurrency(quote.high)} />
        <Stat label="Tief" value={formatCurrency(quote.low)} />
        <Stat label="Volumen" value={formatVolume(quote.volume)} />
        {quote.previousClose > 0 && <Stat label="Vortag" value={formatCurrency(quote.previousClose)} />}
        {quote.marketCap && <Stat label="Marktk." value={formatVolume(quote.marketCap)} />}
        {quote.pe && <Stat label="KGV" value={quote.pe.toFixed(1)} />}
        {quote.week52High && <Stat label="52W Hoch" value={formatCurrency(quote.week52High)} />}
      </div>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-sm font-medium dark:text-white">{value}</div>
    </div>
  )
}
