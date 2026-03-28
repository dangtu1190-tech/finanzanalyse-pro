import type { OHLCV, Quote, SearchResult, Timeframe } from '@/types/market'

// In production: use our own server proxy (/api/yahoo/...)
// In dev: use CORS proxy
const isDev = import.meta.env.DEV

function yahooChartUrl(symbol: string, interval: string, range: string): string {
  if (isDev) {
    // Dev mode: try CORS proxy
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`
  }
  // Production: our own proxy on same domain
  return `/api/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`
}

function yahooSearchUrl(query: string): string {
  if (isDev) {
    const yahooUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`
  }
  return `/api/yahoo-search?q=${encodeURIComponent(query)}`
}

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

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  if (text.startsWith('<')) throw new Error('Got HTML instead of JSON')
  return JSON.parse(text)
}

export async function getYahooHistoricalData(symbol: string, timeframe: Timeframe): Promise<OHLCV[]> {
  const { interval, range } = getYahooParams(timeframe)
  const url = yahooChartUrl(symbol, interval, range)

  const data = await fetchJSON(url)
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
  const url = yahooChartUrl(symbol, '1d', '5d')

  const data = await fetchJSON(url)
  const result = data?.chart?.result?.[0]
  if (!result) throw new Error('No data from Yahoo Finance')

  const meta = result.meta || {}
  const quote = result.indicators?.quote?.[0]

  const closes: number[] = (quote?.close || []).filter((c: number | null) => c != null)
  const price = meta.regularMarketPrice || closes[closes.length - 1] || 0
  const previousClose = meta.chartPreviousClose || meta.previousClose || closes[closes.length - 2] || price
  const change = price - previousClose
  const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0

  const highs: number[] = (quote?.high || []).filter((h: number | null) => h != null)
  const lows: number[] = (quote?.low || []).filter((l: number | null) => l != null)
  const opens: number[] = (quote?.open || []).filter((o: number | null) => o != null)
  const volumes: number[] = (quote?.volume || []).filter((v: number | null) => v != null)

  return {
    symbol: meta.symbol || symbol,
    name: meta.shortName || meta.longName || symbol,
    price: round(price),
    change: round(change),
    changePercent: round(changePercent),
    volume: volumes.length > 0 ? volumes[volumes.length - 1] : 0,
    high: round(highs.length > 0 ? highs[highs.length - 1] : price),
    low: round(lows.length > 0 ? lows[lows.length - 1] : price),
    open: round(opens.length > 0 ? opens[opens.length - 1] : price),
    previousClose: round(previousClose),
    week52High: meta.fiftyTwoWeekHigh ? round(meta.fiftyTwoWeekHigh) : undefined,
    week52Low: meta.fiftyTwoWeekLow ? round(meta.fiftyTwoWeekLow) : undefined,
  }
}

export async function searchYahooSymbols(query: string): Promise<SearchResult[]> {
  const url = yahooSearchUrl(query)
  const data = await fetchJSON(url)
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
