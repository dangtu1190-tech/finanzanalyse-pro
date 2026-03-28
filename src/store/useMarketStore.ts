import { create } from 'zustand'
import type { OHLCV, Quote, Timeframe, ChartType } from '@/types/market'
import type { IndicatorType } from '@/types/indicators'

export type DataSource = 'yahoo' | 'alphavantage' | 'demo'

interface MarketState {
  currentSymbol: string
  ohlcv: OHLCV[]
  quote: Quote | null
  timeframe: Timeframe
  chartType: ChartType
  activeIndicators: IndicatorType[]
  loading: boolean
  error: string | null
  dataSource: DataSource
  setCurrentSymbol: (symbol: string) => void
  setOHLCV: (data: OHLCV[]) => void
  setQuote: (quote: Quote) => void
  setTimeframe: (tf: Timeframe) => void
  setChartType: (ct: ChartType) => void
  toggleIndicator: (ind: IndicatorType) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setDataSource: (source: DataSource) => void
}

export const useMarketStore = create<MarketState>()((set) => ({
  currentSymbol: 'SPY',
  ohlcv: [],
  quote: null,
  timeframe: '6M',
  chartType: 'candlestick',
  activeIndicators: ['sma', 'rsi', 'macd'],
  loading: false,
  error: null,
  dataSource: 'demo',
  setCurrentSymbol: (currentSymbol) => set({ currentSymbol }),
  setOHLCV: (ohlcv) => set({ ohlcv }),
  setQuote: (quote) => set({ quote }),
  setTimeframe: (timeframe) => set({ timeframe }),
  setChartType: (chartType) => set({ chartType }),
  toggleIndicator: (ind) =>
    set((s) => ({
      activeIndicators: s.activeIndicators.includes(ind)
        ? s.activeIndicators.filter((i) => i !== ind)
        : [...s.activeIndicators, ind],
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setDataSource: (dataSource) => set({ dataSource }),
}))
