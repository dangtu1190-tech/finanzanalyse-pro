export interface OHLCV {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Quote {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  high: number
  low: number
  open: number
  previousClose: number
  marketCap?: number
  pe?: number
  dividend?: number
  week52High?: number
  week52Low?: number
}

export type AssetType = 'stock' | 'etf' | 'bond' | 'crypto' | 'index'

export type Timeframe = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y'

export type ChartType = 'candlestick' | 'line' | 'area' | 'bar'

export interface SearchResult {
  symbol: string
  name: string
  type: AssetType
  region: string
}

export interface SymbolData {
  symbol: string
  name: string
  ohlcv: OHLCV[]
  quote?: Quote
}
