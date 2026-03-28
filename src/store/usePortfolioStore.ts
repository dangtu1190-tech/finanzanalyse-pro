import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Position, Trade } from '@/types/portfolio'

interface PortfolioState {
  positions: Position[]
  trades: Trade[]
  addPosition: (pos: Omit<Position, 'id'>) => void
  removePosition: (id: string) => void
  updatePositionPrice: (symbol: string, price: number) => void
  addTrade: (trade: Omit<Trade, 'id'>) => void
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set) => ({
      positions: [],
      trades: [],
      addPosition: (pos) =>
        set((s) => ({
          positions: [...s.positions, { ...pos, id: crypto.randomUUID() }],
        })),
      removePosition: (id) =>
        set((s) => ({
          positions: s.positions.filter((p) => p.id !== id),
        })),
      updatePositionPrice: (symbol, price) =>
        set((s) => ({
          positions: s.positions.map((p) =>
            p.symbol === symbol ? { ...p, currentPrice: price } : p
          ),
        })),
      addTrade: (trade) =>
        set((s) => ({
          trades: [...s.trades, { ...trade, id: crypto.randomUUID() }],
        })),
    }),
    { name: 'fa-portfolio' }
  )
)
