import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Quote } from '@/types/market'

interface WatchlistState {
  symbols: string[]
  quotes: Record<string, Quote>
  addSymbol: (symbol: string) => void
  removeSymbol: (symbol: string) => void
  setQuote: (symbol: string, quote: Quote) => void
  isWatching: (symbol: string) => boolean
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      symbols: ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA'],
      quotes: {},
      addSymbol: (symbol) =>
        set((s) => ({
          symbols: s.symbols.includes(symbol) ? s.symbols : [...s.symbols, symbol],
        })),
      removeSymbol: (symbol) =>
        set((s) => ({
          symbols: s.symbols.filter((s2) => s2 !== symbol),
        })),
      setQuote: (symbol, quote) =>
        set((s) => ({ quotes: { ...s.quotes, [symbol]: quote } })),
      isWatching: (symbol) => get().symbols.includes(symbol),
    }),
    { name: 'fa-watchlist', partialize: (s) => ({ symbols: s.symbols }) }
  )
)
