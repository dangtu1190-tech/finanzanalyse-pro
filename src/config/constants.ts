export const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query'
export const CORS_PROXY = 'https://corsproxy.io/?url='

export const DEFAULT_SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA']

export const SECTOR_ETFS: Record<string, string> = {
  'Technologie': 'XLK',
  'Gesundheit': 'XLV',
  'Finanzen': 'XLF',
  'Energie': 'XLE',
  'Konsum': 'XLY',
  'Industrie': 'XLI',
  'Materialien': 'XLB',
  'Immobilien': 'XLRE',
  'Versorger': 'XLU',
  'Kommunikation': 'XLC',
  'Basiskonsumgüter': 'XLP',
}

export const TIMEFRAMES = [
  { label: '1T', value: '1D', days: 1 },
  { label: '1W', value: '1W', days: 7 },
  { label: '1M', value: '1M', days: 30 },
  { label: '3M', value: '3M', days: 90 },
  { label: '6M', value: '6M', days: 180 },
  { label: '1J', value: '1Y', days: 365 },
  { label: '5J', value: '5Y', days: 1825 },
] as const

export const CHART_TYPES = [
  { label: 'Kerzen', value: 'candlestick' },
  { label: 'Linie', value: 'line' },
  { label: 'Fläche', value: 'area' },
  { label: 'Balken', value: 'bar' },
] as const

export const INDICATOR_PRESETS = {
  sma: { name: 'SMA', periods: [20, 50, 200], colors: ['#f59e0b', '#3b82f6', '#ef4444'] },
  ema: { name: 'EMA', periods: [12, 26, 50], colors: ['#8b5cf6', '#ec4899', '#14b8a6'] },
  rsi: { name: 'RSI', period: 14, overbought: 70, oversold: 30 },
  macd: { name: 'MACD', fast: 12, slow: 26, signal: 9 },
  bollinger: { name: 'Bollinger Bänder', period: 20, stdDev: 2 },
  stochastic: { name: 'Stochastik', kPeriod: 14, dPeriod: 3, smoothing: 3 },
  atr: { name: 'ATR', period: 14 },
}

export const CACHE_TTL = {
  quote: 60_000,
  daily: 3_600_000,
  intraday: 900_000,
  search: 86_400_000,
}
