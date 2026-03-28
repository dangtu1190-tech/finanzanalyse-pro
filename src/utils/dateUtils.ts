import type { Timeframe } from '@/types/market'

export function getDateRange(timeframe: Timeframe): { from: Date; to: Date } {
  const to = new Date()
  const from = new Date()

  const daysMap: Record<Timeframe, number> = {
    '1D': 1,
    '1W': 7,
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    '5Y': 1825,
  }

  from.setDate(from.getDate() - daysMap[timeframe])
  return { from, to }
}

export function dateToTimestamp(date: string): number {
  return Math.floor(new Date(date).getTime() / 1000)
}

export function timestampToDate(ts: number): string {
  return new Date(ts * 1000).toISOString().split('T')[0]
}

export function isMarketOpen(): boolean {
  const now = new Date()
  const nyHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const hour = nyHour.getHours()
  const day = nyHour.getDay()
  return day >= 1 && day <= 5 && hour >= 9 && hour < 16
}
