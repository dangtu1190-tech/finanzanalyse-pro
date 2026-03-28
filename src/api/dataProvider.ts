import type { OHLCV, Quote, SearchResult, Timeframe } from '@/types/market'
import type { DataSource } from '@/store/useMarketStore'
import { getCached, setCache } from './cache'
import { CACHE_TTL } from '@/config/constants'
import * as yahoo from './yahooFinance'
import * as av from './alphaVantage'
import { generateDemoData, generateDemoQuote } from './demoData'

// Data source priority: Yahoo Finance → Alpha Vantage → Demo

let lastDataSource: DataSource = 'demo'
export function getLastDataSource(): DataSource { return lastDataSource }

function hasApiKey(): boolean {
  const key = localStorage.getItem('av_api_key')
  return !!key && key !== 'demo' && key.length > 5
}

export async function getHistoricalData(symbol: string, timeframe: Timeframe): Promise<OHLCV[]> {
  const cacheKey = `ohlcv:${symbol}:${timeframe}`
  const cached = getCached<OHLCV[]>(cacheKey)
  if (cached) return cached

  // 1. Try Yahoo Finance (no API key needed, no rate limit)
  try {
    const data = await yahoo.getYahooHistoricalData(symbol, timeframe)
    if (data.length > 0) {
      lastDataSource = 'yahoo'
      setCache(cacheKey, data, CACHE_TTL.daily)
      return data
    }
  } catch { /* fallthrough */ }

  // 2. Try Alpha Vantage (if API key configured)
  if (hasApiKey()) {
    try {
      let data: OHLCV[]
      if (timeframe === '1D' || timeframe === '1W') {
        data = await av.getDailyTimeSeries(symbol, false)
      } else if (timeframe === '5Y') {
        data = await av.getWeeklyTimeSeries(symbol)
      } else {
        data = await av.getDailyTimeSeries(symbol, timeframe === '1Y')
      }

      const now = Date.now() / 1000
      const daysMap: Record<Timeframe, number> = {
        '1D': 1, '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '5Y': 1825,
      }
      const cutoff = now - daysMap[timeframe] * 86400
      data = data.filter(d => d.time >= cutoff)

      if (data.length > 0) {
        lastDataSource = 'alphavantage'
        setCache(cacheKey, data, CACHE_TTL.daily)
        return data
      }
    } catch { /* fallthrough */ }
  }

  // 3. Fallback to demo data
  lastDataSource = 'demo'
  const data = generateDemoData(symbol, timeframe)
  setCache(cacheKey, data, CACHE_TTL.daily)
  return data
}

export async function getQuote(symbol: string): Promise<Quote> {
  const cacheKey = `quote:${symbol}`
  const cached = getCached<Quote>(cacheKey)
  if (cached) return cached

  // 1. Try Yahoo Finance
  try {
    const quote = await yahoo.getYahooQuote(symbol)
    if (quote.price > 0) {
      lastDataSource = 'yahoo'
      setCache(cacheKey, quote, CACHE_TTL.quote)
      return quote
    }
  } catch { /* fallthrough */ }

  // 2. Try Alpha Vantage
  if (hasApiKey()) {
    try {
      const quote = await av.getQuote(symbol)
      lastDataSource = 'alphavantage'
      setCache(cacheKey, quote, CACHE_TTL.quote)
      return quote
    } catch { /* fallthrough */ }
  }

  // 3. Demo fallback
  lastDataSource = 'demo'
  const quote = generateDemoQuote(symbol)
  setCache(cacheKey, quote, CACHE_TTL.quote)
  return quote
}

export async function searchSymbols(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 1) return []

  const cacheKey = `search:${query}`
  const cached = getCached<SearchResult[]>(cacheKey)
  if (cached) return cached

  // 1. Try Yahoo Finance search
  try {
    const results = await yahoo.searchYahooSymbols(query)
    if (results.length > 0) {
      setCache(cacheKey, results, CACHE_TTL.search)
      return results
    }
  } catch { /* fallthrough */ }

  // 2. Try Alpha Vantage
  if (hasApiKey()) {
    try {
      const results = await av.searchSymbols(query)
      setCache(cacheKey, results, CACHE_TTL.search)
      return results
    } catch { /* fallthrough */ }
  }

  // 3. Static fallback
  const popular = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'VOO', 'META']
  return popular
    .filter(s => s.toLowerCase().includes(query.toLowerCase()))
    .map(s => ({ symbol: s, name: s, type: 'stock' as const, region: 'US' }))
}
