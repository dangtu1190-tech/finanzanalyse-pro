import { useState, useRef, useEffect } from 'react'
import { Search, Sun, Moon } from 'lucide-react'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useMarketStore } from '@/store/useMarketStore'
import { useNavigate } from 'react-router-dom'
import { searchSymbols } from '@/api/dataProvider'
import { useDebounce } from '@/hooks/useDebounce'
import type { SearchResult } from '@/types/market'

export function TopBar() {
  const { theme, toggleTheme } = useSettingsStore()
  const setCurrentSymbol = useMarketStore((s) => s.setCurrentSymbol)
  const currentSymbol = useMarketStore((s) => s.currentSymbol)
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (debouncedQuery.length >= 1) {
      searchSymbols(debouncedQuery).then(setResults)
    } else {
      setResults([])
    }
  }, [debouncedQuery])

  function handleSelect(symbol: string) {
    setCurrentSymbol(symbol)
    setQuery('')
    setShowResults(false)
    navigate('/chart')
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-bg-card-dark)]">
      {/* Search */}
      <div className="relative w-80">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true) }}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder="Symbol suchen... (z.B. AAPL, SPY)"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
        {showResults && results.length > 0 && (
          <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {results.slice(0, 8).map((r) => (
              <button
                key={r.symbol}
                onMouseDown={() => handleSelect(r.symbol)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="font-medium text-gray-900 dark:text-white">{r.symbol}</span>
                <span className="truncate ml-2 text-xs text-gray-500 dark:text-gray-400">{r.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Current Symbol */}
        <span className="rounded-lg bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
          {currentSymbol}
        </span>

        {/* Theme Toggle */}
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
