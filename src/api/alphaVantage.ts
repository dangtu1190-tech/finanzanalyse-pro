import { ALPHA_VANTAGE_BASE } from '@/config/constants'
import type { OHLCV, Quote, SearchResult } from '@/types/market'
import { dateToTimestamp } from '@/utils/dateUtils'

function getApiKey(): string {
  return localStorage.getItem('av_api_key') || 'demo'
}

async function fetchAV(params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = new URL(ALPHA_VANTAGE_BASE)
  url.searchParams.set('apikey', getApiKey())
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`AV API error: ${res.status}`)
  const data = await res.json()
  if (data['Error Message']) throw new Error(data['Error Message'])
  if (data['Note']) throw new Error('API rate limit reached')
  return data
}

export async function searchSymbols(query: string): Promise<SearchResult[]> {
  const data = await fetchAV({ function: 'SYMBOL_SEARCH', keywords: query })
  const matches = (data['bestMatches'] || []) as Record<string, string>[]
  return matches.map(m => ({
    symbol: m['1. symbol'],
    name: m['2. name'],
    type: (m['3. type']?.toLowerCase() || 'stock') as SearchResult['type'],
    region: m['4. region'] || '',
  }))
}

export async function getDailyTimeSeries(symbol: string, full = false): Promise<OHLCV[]> {
  const data = await fetchAV({
    function: 'TIME_SERIES_DAILY',
    symbol,
    outputsize: full ? 'full' : 'compact',
  })
  const ts = data['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined
  if (!ts) return []

  return Object.entries(ts)
    .map(([date, values]) => ({
      time: dateToTimestamp(date),
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume']),
    }))
    .sort((a, b) => a.time - b.time)
}

export async function getQuote(symbol: string): Promise<Quote> {
  const data = await fetchAV({ function: 'GLOBAL_QUOTE', symbol })
  const q = data['Global Quote'] as Record<string, string>
  if (!q) throw new Error(`No quote data for ${symbol}`)
  return {
    symbol: q['01. symbol'],
    name: symbol,
    price: parseFloat(q['05. price']),
    change: parseFloat(q['09. change']),
    changePercent: parseFloat(q['10. change percent']?.replace('%', '') || '0'),
    volume: parseInt(q['06. volume']),
    high: parseFloat(q['03. high']),
    low: parseFloat(q['04. low']),
    open: parseFloat(q['02. open']),
    previousClose: parseFloat(q['08. previous close']),
  }
}

export async function getWeeklyTimeSeries(symbol: string): Promise<OHLCV[]> {
  const data = await fetchAV({ function: 'TIME_SERIES_WEEKLY', symbol })
  const ts = data['Weekly Time Series'] as Record<string, Record<string, string>> | undefined
  if (!ts) return []

  return Object.entries(ts)
    .map(([date, values]) => ({
      time: dateToTimestamp(date),
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume']),
    }))
    .sort((a, b) => a.time - b.time)
}
