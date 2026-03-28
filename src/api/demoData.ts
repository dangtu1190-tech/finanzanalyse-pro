import type { OHLCV, Quote, Timeframe } from '@/types/market'

// Generates realistic demo OHLCV data when API is unavailable
export function generateDemoData(symbol: string, timeframe: Timeframe): OHLCV[] {
  const seed = hashCode(symbol)
  const basePrice = 50 + (seed % 400)
  const volatility = 0.015 + (seed % 10) * 0.002

  const daysMap: Record<Timeframe, number> = {
    '1D': 78, '1W': 50, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '5Y': 260,
  }
  const count = daysMap[timeframe]
  const now = Math.floor(Date.now() / 1000)
  const interval = timeframe === '1D' ? 300 : timeframe === '5Y' ? 604800 : 86400

  const data: OHLCV[] = []
  let price = basePrice
  const rng = mulberry32(seed)

  for (let i = 0; i < count; i++) {
    const time = now - (count - i) * interval
    const change = (rng() - 0.48) * volatility * price
    const open = price
    price = Math.max(1, price + change)
    const high = Math.max(open, price) * (1 + rng() * 0.01)
    const low = Math.min(open, price) * (1 - rng() * 0.01)
    const volume = Math.floor(1e6 + rng() * 5e6)

    data.push({
      time,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(price),
      volume,
    })
  }
  return data
}

export function generateDemoQuote(symbol: string): Quote {
  const seed = hashCode(symbol)
  const price = 50 + (seed % 400) + (seed % 50)
  const change = (seed % 20) - 10
  const changePercent = (change / price) * 100

  return {
    symbol,
    name: getDemoName(symbol),
    price: round(price),
    change: round(change),
    changePercent: round(changePercent),
    volume: 1e6 + (seed % 50) * 1e5,
    high: round(price * 1.02),
    low: round(price * 0.98),
    open: round(price - change * 0.5),
    previousClose: round(price - change),
    marketCap: price * 1e9,
    pe: 15 + (seed % 30),
    week52High: round(price * 1.3),
    week52Low: round(price * 0.7),
  }
}

function getDemoName(symbol: string): string {
  const names: Record<string, string> = {
    SPY: 'SPDR S&P 500 ETF',
    QQQ: 'Invesco QQQ Trust',
    AAPL: 'Apple Inc.',
    MSFT: 'Microsoft Corp.',
    GOOGL: 'Alphabet Inc.',
    AMZN: 'Amazon.com Inc.',
    TSLA: 'Tesla Inc.',
    NVDA: 'NVIDIA Corp.',
    META: 'Meta Platforms Inc.',
    VOO: 'Vanguard S&P 500 ETF',
    VTI: 'Vanguard Total Stock Market ETF',
    BND: 'Vanguard Total Bond Market ETF',
    XLK: 'Technology Select Sector SPDR',
    XLV: 'Health Care Select Sector SPDR',
    XLF: 'Financial Select Sector SPDR',
    XLE: 'Energy Select Sector SPDR',
    XLY: 'Consumer Discretionary SPDR',
    XLI: 'Industrial Select Sector SPDR',
    XLB: 'Materials Select Sector SPDR',
    XLRE: 'Real Estate Select Sector SPDR',
    XLU: 'Utilities Select Sector SPDR',
    XLC: 'Communication Services SPDR',
    XLP: 'Consumer Staples SPDR',
  }
  return names[symbol] || symbol
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function mulberry32(seed: number) {
  let t = seed + 0x6d2b79f5
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
