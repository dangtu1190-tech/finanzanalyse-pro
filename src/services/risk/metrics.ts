import { mean, standardDeviation, downsideDeviation, maxDrawdown, returns, covariance } from '@/utils/mathUtils'
import type { RiskMetrics } from '@/types/portfolio'
import type { OHLCV } from '@/types/market'

const RISK_FREE_RATE = 0.045 // ~4.5% annualized
const TRADING_DAYS = 252

export function calculateRiskMetrics(
  portfolioPrices: number[],
  benchmarkPrices?: number[]
): RiskMetrics {
  const dailyReturns = returns(portfolioPrices)
  if (dailyReturns.length < 10) {
    return { sharpeRatio: 0, sortinoRatio: 0, maxDrawdown: 0, volatility: 0, beta: 0, alpha: 0 }
  }

  const avgReturn = mean(dailyReturns)
  const stdDev = standardDeviation(dailyReturns)
  const downDev = downsideDeviation(dailyReturns)
  const dailyRf = RISK_FREE_RATE / TRADING_DAYS

  // Annualized
  const annualReturn = avgReturn * TRADING_DAYS
  const annualVol = stdDev * Math.sqrt(TRADING_DAYS)

  const sharpeRatio = stdDev === 0 ? 0 : (annualReturn - RISK_FREE_RATE) / annualVol
  const annualDownDev = downDev * Math.sqrt(TRADING_DAYS)
  const sortinoRatio = annualDownDev === 0 ? 0 : (annualReturn - RISK_FREE_RATE) / annualDownDev
  const mdd = maxDrawdown(portfolioPrices)

  let beta = 0
  let alpha = 0
  if (benchmarkPrices && benchmarkPrices.length > 10) {
    const benchReturns = returns(benchmarkPrices)
    const len = Math.min(dailyReturns.length, benchReturns.length)
    const portSlice = dailyReturns.slice(-len)
    const benchSlice = benchReturns.slice(-len)
    const benchVar = standardDeviation(benchSlice) ** 2
    beta = benchVar === 0 ? 0 : covariance(portSlice, benchSlice) / benchVar
    const benchAnnual = mean(benchSlice) * TRADING_DAYS
    alpha = annualReturn - (dailyRf * TRADING_DAYS + beta * (benchAnnual - RISK_FREE_RATE))
  }

  return {
    sharpeRatio: round(sharpeRatio),
    sortinoRatio: round(sortinoRatio),
    maxDrawdown: round(mdd * 100),
    volatility: round(annualVol * 100),
    beta: round(beta),
    alpha: round(alpha * 100),
  }
}

export function portfolioEquityCurve(
  positionData: { ohlcv: OHLCV[]; quantity: number }[]
): { time: number; value: number }[] {
  if (positionData.length === 0) return []

  const timeMap = new Map<number, number>()

  for (const { ohlcv, quantity } of positionData) {
    for (const bar of ohlcv) {
      const current = timeMap.get(bar.time) || 0
      timeMap.set(bar.time, current + bar.close * quantity)
    }
  }

  return Array.from(timeMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time, value }))
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
