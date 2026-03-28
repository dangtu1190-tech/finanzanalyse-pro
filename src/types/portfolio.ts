export interface Position {
  id: string
  symbol: string
  name: string
  quantity: number
  entryPrice: number
  entryDate: string
  currentPrice?: number
  type: 'stock' | 'etf' | 'bond'
}

export interface Trade {
  id: string
  symbol: string
  type: 'buy' | 'sell'
  quantity: number
  price: number
  date: string
  fees: number
}

export interface PortfolioSummary {
  totalValue: number
  totalCost: number
  totalPnL: number
  totalPnLPercent: number
  dayChange: number
  dayChangePercent: number
  positions: Position[]
}

export interface RiskMetrics {
  sharpeRatio: number
  sortinoRatio: number
  maxDrawdown: number
  volatility: number
  beta: number
  alpha: number
}
