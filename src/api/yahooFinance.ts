import type { OHLCV, Quote, SearchResult, Timeframe } from '@/types/market'

const PROXY = 'https://corsproxy.io/?url='

function yahooUrl(path: string): string {
  return `${PROXY}${encodeURIComponent(`https://query1.finance.yahoo.com${path}`)}`
}

// Map timeframe to Yahoo Finance interval & range
function getYahooParams(timeframe: Timeframe): { interval: string; range: string } {
  switch (timeframe) {
    case '1D': return { interval: '5m', range: '1d' }
    case '1W': return { interval: '15m', range: '5d' }
    case '1M': return { interval: '1d', range: '1mo' }
    case '3M': return { interval: '1d', range: '3mo' }
    case '6M': return { interval: '1d', range: '6mo' }
    case '1Y': return { interval: '1wk', range: '1y' }
    case '5Y': return { interval: '1mo', range: '5y' }
  }
}

export async function getYahooHistoricalData(symbol: string, timeframe: Timeframe): Promise<OHLCV[]> {
  const { interval, range } = getYahooParams(timeframe)
  const url = yahooUrl(`/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Yahoo API error: ${res.status}`)

  const data = await res.json()
  const result = data?.chart?.result?.[0]
  if (!result) throw new Error('No data from Yahoo Finance')

  const timestamps: number[] = result.timestamp || []
  const quote = result.indicators?.quote?.[0]
  if (!quote) throw new Error('No quote data')

  const ohlcv: OHLCV[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open?.[i]
    const high = quote.high?.[i]
    const low = quote.low?.[i]
    const close = quote.close?.[i]
    const volume = quote.volume?.[i]

    // Skip null/NaN entries
    if (open == null || high == null || low == null || close == null) continue

    ohlcv.push({
      time: timestamps[i],
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: volume || 0,
    })
  }

  return ohlcv
}

export async function getYahooQuote(symbol: string): Promise<Quote> {
  const url = yahooUrl(`/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Yahoo API error: ${res.status}`)

  const data = await res.json()
  const result = data?.chart?.result?.[0]
  if (!result) throw new Error('No data from Yahoo Finance')

  const meta = result.meta || {}
  const quote = result.indicators?.quote?.[0]
  const timestamps: number[] = result.timestamp || []

  // Get last and previous close
  const closes: number[] = (quote?.close || []).filter((c: number | null) => c != null)
  const price = meta.regularMarketPrice || closes[closes.length - 1] || 0
  const previousClose = meta.chartPreviousClose || meta.previousClose || closes[closes.length - 2] || price
  const change = price - previousClose
  const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0

  // Today's data
  const highs: number[] = (quote?.high || []).filter((h: number | null) => h != null)
  const lows: number[] = (quote?.low || []).filter((l: number | null) => l != null)
  const opens: number[] = (quote?.open || []).filter((o: number | null) => o != null)
  const volumes: number[] = (quote?.volume || []).filter((v: number | null) => v != null)

  const todayHigh = highs.length > 0 ? highs[highs.length - 1] : price
  const todayLow = lows.length > 0 ? lows[lows.length - 1] : price
  const todayOpen = opens.length > 0 ? opens[opens.length - 1] : price
  const todayVolume = volumes.length > 0 ? volumes[volumes.length - 1] : 0

  return {
    symbol: meta.symbol || symbol,
    name: meta.shortName || meta.longName || symbol,
    price: round(price),
    change: round(change),
    changePercent: round(changePercent),
    volume: todayVolume,
    high: round(todayHigh),
    low: round(todayLow),
    open: round(todayOpen),
    previousClose: round(previousClose),
    week52High: meta.fiftyTwoWeekHigh ? round(meta.fiftyTwoWeekHigh) : undefined,
    week52Low: meta.fiftyTwoWeekLow ? round(meta.fiftyTwoWeekLow) : undefined,
  }
}

export async function searchYahooSymbols(query: string): Promise<SearchResult[]> {
  const url = `${PROXY}${encodeURIComponent(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`)}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Yahoo Search error: ${res.status}`)

  const data = await res.json()
  const quotes = data?.quotes || []

  return quotes.map((q: any) => ({
    symbol: q.symbol || '',
    name: q.shortname || q.longname || q.symbol || '',
    type: mapYahooType(q.quoteType),
    region: q.exchange || '',
  }))
}

function mapYahooType(type: string | undefined): SearchResult['type'] {
  switch (type?.toUpperCase()) {
    case 'ETF': return 'etf'
    case 'BOND':
    case 'MUTUALFUND': return 'bond'
    case 'CRYPTOCURRENCY': return 'crypto'
    case 'INDEX': return 'index'
    default: return 'stock'
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
