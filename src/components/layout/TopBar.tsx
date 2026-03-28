import { useState, useRef, useEffect } from 'react'
import { Search, Sun, Moon } from 'lucide-react'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useMarketStore } from '@/store/useMarketStore'
import { useNavigate } from 'react-router-dom'
import { searchSymbols } from '@/api/dataProvider'
import { useDebounce } from '@/hooks/useDebounce'
import { POPULAR_MARKETS, DAX_SYMBOLS, SECTOR_ETFS } from '@/config/constants'
import type { SearchResult } from '@/types/market'

// Local search across all known symbols (instant, no API call)
const ALL_LOCAL: [string, string, string][] = [
  // DAX
  ...Object.entries(DAX_SYMBOLS).map(([s, n]) => [s, n, 'XETRA'] as [string, string, string]),
  // Sector ETFs
  ...Object.entries(SECTOR_ETFS).map(([n, s]) => [s, `${n} ETF`, 'US'] as [string, string, string]),
  // Popular US
  ...([
    ['AAPL', 'Apple Inc.'], ['MSFT', 'Microsoft Corp.'], ['GOOGL', 'Alphabet Inc.'],
    ['AMZN', 'Amazon.com Inc.'], ['TSLA', 'Tesla Inc.'], ['NVDA', 'NVIDIA Corp.'],
    ['META', 'Meta Platforms'], ['JPM', 'JPMorgan Chase'], ['V', 'Visa Inc.'],
    ['JNJ', 'Johnson & Johnson'], ['WMT', 'Walmart Inc.'], ['PG', 'Procter & Gamble'],
    ['UNH', 'UnitedHealth'], ['HD', 'Home Depot'], ['MA', 'Mastercard'],
    ['DIS', 'Walt Disney'], ['NFLX', 'Netflix'], ['AMD', 'AMD'], ['INTC', 'Intel'],
    ['CRM', 'Salesforce'], ['PYPL', 'PayPal'], ['BA', 'Boeing'], ['KO', 'Coca-Cola'],
    ['PEP', 'PepsiCo'], ['NKE', 'Nike'], ['COST', 'Costco'], ['ABBV', 'AbbVie'],
  ] as [string, string][]).map(([s, n]) => [s, n, 'US'] as [string, string, string]),
  // Indizes / ETFs
  ...([
    ['SPY', 'SPDR S&P 500 ETF'], ['QQQ', 'Invesco NASDAQ 100'], ['DIA', 'SPDR Dow Jones'],
    ['VOO', 'Vanguard S&P 500'], ['VTI', 'Vanguard Total Market'], ['IWM', 'Russell 2000'],
    ['EXS1.DE', 'iShares DAX ETF'], ['EUNL.DE', 'iShares MSCI World'],
    ['VWRL.AS', 'Vanguard FTSE All-World'],
  ] as [string, string][]).map(([s, n]) => [s, n, 'ETF'] as [string, string, string]),
  // Europa
  ...([
    ['NESN.SW', 'Nestlé'], ['ASML.AS', 'ASML Holding'], ['MC.PA', 'LVMH'],
    ['NOVO-B.CO', 'Novo Nordisk'], ['OR.PA', 'L\'Oréal'], ['SAN.PA', 'Sanofi'],
    ['ROG.SW', 'Roche'], ['NOVN.SW', 'Novartis'],
  ] as [string, string][]).map(([s, n]) => [s, n, 'EU'] as [string, string, string]),
  // Crypto & Rohstoffe
  ...([
    ['BTC-USD', 'Bitcoin'], ['ETH-USD', 'Ethereum'], ['SOL-USD', 'Solana'],
    ['GC=F', 'Gold Futures'], ['SI=F', 'Silber Futures'], ['CL=F', 'Öl (WTI)'],
    ['EURUSD=X', 'EUR/USD'], ['GBPUSD=X', 'GBP/USD'],
  ] as [string, string][]).map(([s, n]) => [s, n, 'Markt'] as [string, string, string]),
]

function localSearch(query: string): SearchResult[] {
  const q = query.toLowerCase()
  return ALL_LOCAL
    .filter(([symbol, name]) =>
      symbol.toLowerCase().includes(q) || name.toLowerCase().includes(q)
    )
    .slice(0, 8)
    .map(([symbol, name, region]) => ({ symbol, name, type: 'stock' as const, region }))
}

export function TopBar() {
  const { theme, toggleTheme } = useSettingsStore()
  const setCurrentSymbol = useMarketStore((s) => s.setCurrentSymbol)
  const currentSymbol = useMarketStore((s) => s.currentSymbol)
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (debouncedQuery.length >= 1) {
      // Combine local DAX search + Yahoo search
      const local = localSearch(debouncedQuery)
      setResults(local) // Show local results instantly

      searchSymbols(debouncedQuery).then(remote => {
        // Merge: local first, then remote (dedup)
        const localSymbols = new Set(local.map(r => r.symbol))
        const merged = [...local, ...remote.filter(r => !localSymbols.has(r.symbol))]
        setResults(merged.slice(0, 10))
      })
    } else {
      setResults([])
    }
  }, [debouncedQuery])

  function handleSelect(symbol: string) {
    setCurrentSymbol(symbol)
    setQuery('')
    setShowDropdown(false)
    navigate('/chart')
  }

  const showQuickAccess = showDropdown && query.length === 0

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-bg-card-dark)]">
      {/* Search */}
      <div className="relative ml-10 w-48 sm:ml-0 sm:w-64 lg:w-96">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowDropdown(true) }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder="Aktie suchen... (z.B. Volkswagen, AAPL, SAP)"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />

        {/* Search Results */}
        {showDropdown && results.length > 0 && query.length > 0 && (
          <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800 max-h-80 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.symbol}
                onMouseDown={() => handleSelect(r.symbol)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white">{r.symbol}</span>
                  {r.region && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                      {r.region}
                    </span>
                  )}
                </div>
                <span className="truncate ml-2 max-w-40 text-xs text-gray-500 dark:text-gray-400">{r.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Quick Access when empty */}
        {showQuickAccess && (
          <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800 max-h-96 overflow-y-auto">
            {Object.entries(POPULAR_MARKETS).map(([group, items]) => (
              <div key={group} className="mb-3 last:mb-0">
                <div className="mb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">{group}</div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map(item => (
                    <button
                      key={item.symbol}
                      onMouseDown={() => handleSelect(item.symbol)}
                      className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                    >
                      <span className="font-semibold">{item.symbol}</span>
                      <span className="ml-1 text-gray-400">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden rounded-lg bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-600 sm:inline dark:bg-blue-900/20 dark:text-blue-400">
          {currentSymbol}
        </span>
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  )
}
