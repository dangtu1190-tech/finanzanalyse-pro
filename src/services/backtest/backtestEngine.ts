import type { OHLCV } from '@/types/market'
import { calcSMA, calcEMA, calcRSI, calcMACD } from '../indicators'

export type StrategyType = 'sma_cross' | 'rsi_reversal' | 'macd_cross' | 'bollinger_bounce'

export interface BacktestConfig {
  strategy: StrategyType
  initialCapital: number
  positionSizePercent: number
  stopLossPercent: number | null
  takeProfitPercent: number | null
}

export interface BacktestTrade {
  type: 'buy' | 'sell'
  entryTime: number
  exitTime: number
  entryPrice: number
  exitPrice: number
  quantity: number
  pnl: number
  pnlPercent: number
  reason: string
}

export interface BacktestResult {
  totalReturn: number
  totalReturnPercent: number
  annualizedReturn: number
  maxDrawdown: number
  winRate: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
  averageWin: number
  averageLoss: number
  profitFactor: number
  sharpeRatio: number
  trades: BacktestTrade[]
  equityCurve: { time: number; value: number }[]
  buyHoldReturn: number
  buyHoldReturnPercent: number
}

export function runBacktest(data: OHLCV[], config: BacktestConfig): BacktestResult {
  const { strategy, initialCapital, positionSizePercent, stopLossPercent, takeProfitPercent } = config

  const signals = generateStrategySignals(data, strategy)
  const trades: BacktestTrade[] = []
  const equityCurve: { time: number; value: number }[] = []

  let capital = initialCapital
  let position = 0
  let entryPrice = 0
  let entryTime = 0
  let peakCapital = initialCapital
  let maxDrawdown = 0

  for (let i = 0; i < data.length; i++) {
    const bar = data[i]
    const signal = signals[i]

    // Track equity
    const equity = position > 0 ? capital + position * bar.close : capital
    equityCurve.push({ time: bar.time, value: equity })

    // Drawdown
    if (equity > peakCapital) peakCapital = equity
    const dd = (peakCapital - equity) / peakCapital
    if (dd > maxDrawdown) maxDrawdown = dd

    // Check stop-loss / take-profit
    if (position > 0) {
      const pnlPct = (bar.close - entryPrice) / entryPrice * 100

      if (stopLossPercent && pnlPct <= -stopLossPercent) {
        const exitPrice = entryPrice * (1 - stopLossPercent / 100)
        const pnl = (exitPrice - entryPrice) * position
        trades.push({
          type: 'sell', entryTime, exitTime: bar.time,
          entryPrice, exitPrice: round(exitPrice),
          quantity: position, pnl: round(pnl),
          pnlPercent: round(pnlPct), reason: 'Stop-Loss',
        })
        capital += position * exitPrice
        position = 0
        continue
      }

      if (takeProfitPercent && pnlPct >= takeProfitPercent) {
        const exitPrice = entryPrice * (1 + takeProfitPercent / 100)
        const pnl = (exitPrice - entryPrice) * position
        trades.push({
          type: 'sell', entryTime, exitTime: bar.time,
          entryPrice, exitPrice: round(exitPrice),
          quantity: position, pnl: round(pnl),
          pnlPercent: round(pnlPct), reason: 'Take-Profit',
        })
        capital += position * exitPrice
        position = 0
        continue
      }
    }

    // Execute signals
    if (signal === 'BUY' && position === 0) {
      const investAmount = capital * (positionSizePercent / 100)
      position = Math.floor(investAmount / bar.close)
      if (position > 0) {
        entryPrice = bar.close
        entryTime = bar.time
        capital -= position * bar.close
      }
    } else if (signal === 'SELL' && position > 0) {
      const pnl = (bar.close - entryPrice) * position
      const pnlPct = (bar.close - entryPrice) / entryPrice * 100
      trades.push({
        type: 'sell', entryTime, exitTime: bar.time,
        entryPrice, exitPrice: bar.close,
        quantity: position, pnl: round(pnl),
        pnlPercent: round(pnlPct), reason: 'Signal',
      })
      capital += position * bar.close
      position = 0
    }
  }

  // Close open position at end
  if (position > 0) {
    const lastPrice = data[data.length - 1].close
    const pnl = (lastPrice - entryPrice) * position
    trades.push({
      type: 'sell', entryTime, exitTime: data[data.length - 1].time,
      entryPrice, exitPrice: lastPrice,
      quantity: position, pnl: round(pnl),
      pnlPercent: round((lastPrice - entryPrice) / entryPrice * 100),
      reason: 'Ende',
    })
    capital += position * lastPrice
    position = 0
  }

  // Calculate stats
  const finalEquity = capital
  const totalReturn = finalEquity - initialCapital
  const totalReturnPercent = (totalReturn / initialCapital) * 100
  const tradingDays = data.length
  const years = tradingDays / 252
  const annualizedReturn = years > 0 ? (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100 : 0

  const wins = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl <= 0)
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlPercent, 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnlPercent, 0) / losses.length : 0
  const totalWins = wins.reduce((s, t) => s + t.pnl, 0)
  const totalLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0

  // Simple Sharpe approximation
  const dailyReturns: number[] = []
  for (let i = 1; i < equityCurve.length; i++) {
    dailyReturns.push((equityCurve[i].value - equityCurve[i - 1].value) / equityCurve[i - 1].value)
  }
  const avgDailyReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length
  const stdDev = Math.sqrt(dailyReturns.reduce((s, r) => s + (r - avgDailyReturn) ** 2, 0) / dailyReturns.length)
  const sharpeRatio = stdDev > 0 ? (avgDailyReturn / stdDev) * Math.sqrt(252) : 0

  // Buy & Hold comparison
  const buyHoldReturn = data.length > 0
    ? (data[data.length - 1].close - data[0].close) / data[0].close * initialCapital
    : 0
  const buyHoldReturnPercent = data.length > 0
    ? (data[data.length - 1].close - data[0].close) / data[0].close * 100
    : 0

  return {
    totalReturn: round(totalReturn),
    totalReturnPercent: round(totalReturnPercent),
    annualizedReturn: round(annualizedReturn),
    maxDrawdown: round(maxDrawdown * 100),
    winRate: round(winRate),
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    averageWin: round(avgWin),
    averageLoss: round(avgLoss),
    profitFactor: round(profitFactor),
    sharpeRatio: round(sharpeRatio),
    trades,
    equityCurve,
    buyHoldReturn: round(buyHoldReturn),
    buyHoldReturnPercent: round(buyHoldReturnPercent),
  }
}

function generateStrategySignals(data: OHLCV[], strategy: StrategyType): ('BUY' | 'SELL' | 'NONE')[] {
  const signals: ('BUY' | 'SELL' | 'NONE')[] = new Array(data.length).fill('NONE')

  switch (strategy) {
    case 'sma_cross': {
      const smaFast = calcSMA(data, 20)
      const smaSlow = calcSMA(data, 50)
      const offset = data.length - Math.min(smaFast.length, smaSlow.length)
      for (let i = 1; i < Math.min(smaFast.length, smaSlow.length); i++) {
        const prevFast = smaFast[i - 1].value
        const prevSlow = smaSlow[i - 1].value
        const curFast = smaFast[i].value
        const curSlow = smaSlow[i].value
        if (prevFast <= prevSlow && curFast > curSlow) signals[i + offset] = 'BUY'
        if (prevFast >= prevSlow && curFast < curSlow) signals[i + offset] = 'SELL'
      }
      break
    }
    case 'rsi_reversal': {
      const rsi = calcRSI(data, 14)
      const offset = data.length - rsi.length
      for (let i = 1; i < rsi.length; i++) {
        if (rsi[i - 1].value < 30 && rsi[i].value >= 30) signals[i + offset] = 'BUY'
        if (rsi[i - 1].value > 70 && rsi[i].value <= 70) signals[i + offset] = 'SELL'
      }
      break
    }
    case 'macd_cross': {
      const macd = calcMACD(data, 12, 26, 9)
      const offset = data.length - macd.length
      for (let i = 1; i < macd.length; i++) {
        if (macd[i - 1].histogram <= 0 && macd[i].histogram > 0) signals[i + offset] = 'BUY'
        if (macd[i - 1].histogram >= 0 && macd[i].histogram < 0) signals[i + offset] = 'SELL'
      }
      break
    }
    case 'bollinger_bounce': {
      const ema = calcEMA(data, 20)
      const offset = data.length - ema.length
      // Simple: buy when price crosses above lower area, sell at upper
      for (let i = 20; i < data.length; i++) {
        const emaIdx = i - offset
        if (emaIdx < 1 || emaIdx >= ema.length) continue
        const priceLow = data[i].low < ema[emaIdx].value * 0.97
        const priceHigh = data[i].high > ema[emaIdx].value * 1.03
        if (priceLow && data[i].close > data[i].open) signals[i] = 'BUY'
        if (priceHigh && data[i].close < data[i].open) signals[i] = 'SELL'
      }
      break
    }
  }

  return signals
}

export function getStrategyName(strategy: StrategyType): string {
  return {
    sma_cross: 'SMA Kreuzung (20/50)',
    rsi_reversal: 'RSI Umkehr (30/70)',
    macd_cross: 'MACD Kreuzung',
    bollinger_bounce: 'Bollinger Abpraller',
  }[strategy]
}

export function getStrategyDescription(strategy: StrategyType): string {
  return {
    sma_cross: 'Kauft wenn SMA20 den SMA50 nach oben kreuzt, verkauft bei Kreuzung nach unten.',
    rsi_reversal: 'Kauft wenn RSI von unter 30 nach oben dreht, verkauft wenn RSI von über 70 nach unten dreht.',
    macd_cross: 'Kauft bei positivem MACD-Histogramm-Crossover, verkauft bei negativem.',
    bollinger_bounce: 'Kauft bei Abpraller am unteren Band, verkauft nahe dem oberen Band.',
  }[strategy]
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
