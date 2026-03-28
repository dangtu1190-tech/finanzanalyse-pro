import type { OHLCV, Quote, SearchResult, Timeframe } from '@/types/market'
import { getCached, setCache } from './cache'
import { CACHE_TTL } from '@/config/constants'
import * as av from './alphaVantage'
import { generateDemoData, generateDemoQuote } from './demoData'

export async function getHistoricalData(symbol: string, timeframe: Timeframe): Promise<OHLCV[]> {
  const cacheKey = `ohlcv:${symbol}:${timeframe}`
  const cached = getCached<OHLCV[]>(cacheKey)
  if (cached) return cached

  try {
    let data: OHLCV[]
    if (timeframe === '1D' || timeframe === '1W') {
      data = await av.getDailyTimeSeries(symbol, false)
    } else if (timeframe === '5Y') {
      data = await av.getWeeklyTimeSeries(symbol)
    } else {
      data = await av.getDailyTimeSeries(symbol, timeframe === '1Y')
    }

    // Filter by timeframe
    const now = Date.now() / 1000
    const daysMap: Record<Timeframe, number> = {
      '1D': 1, '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '5Y': 1825,
    }
    const cutoff = now - daysMap[timeframe] * 86400
    data = data.filter(d => d.time >= cutoff)

    if (data.length > 0) {
      setCache(cacheKey, data, CACHE_TTL.daily)
    }
    return data
  } catch {
    // Fallback to demo data
    const data = generateDemoData(symbol, timeframe)
    setCache(cacheKey, data, CACHE_TTL.daily)
    return data
  }
}

export async function getQuote(symbol: string): Promise<Quote> {
  const cacheKey = `quote:${symbol}`
  const cached = getCached<Quote>(cacheKey)
  if (cached) return cached

  try {
    const quote = await av.getQuote(symbol)
    setCache(cacheKey, quote, CACHE_TTL.quote)
    return quote
  } catch {
    const quote = generateDemoQuote(symbol)
    setCache(cacheKey, quote, CACHE_TTL.quote)
    return quote
  }
}

export async function searchSymbols(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 1) return []

  const cacheKey = `search:${query}`
  const cached = getCached<SearchResult[]>(cacheKey)
  if (cached) return cached

  try {
    const results = await av.searchSymbols(query)
    setCache(cacheKey, results, CACHE_TTL.search)
    return results
  } catch {
    // Fallback: return popular matches
    const popular = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'VOO', 'META']
    return popular
      .filter(s => s.toLowerCase().includes(query.toLowerCase()))
      .map(s => ({ symbol: s, name: s, type: 'stock' as const, region: 'US' }))
  }
}
