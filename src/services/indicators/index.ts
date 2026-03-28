import type { OHLCV } from '@/types/market'
import type { IndicatorValue, MACDValue, BollingerValue, StochasticValue } from '@/types/indicators'

export function calcSMA(data: OHLCV[], period: number): IndicatorValue[] {
  const result: IndicatorValue[] = []
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = 0; j < period; j++) sum += data[i - j].close
    result.push({ time: data[i].time, value: sum / period })
  }
  return result
}

export function calcEMA(data: OHLCV[], period: number): IndicatorValue[] {
  if (data.length < period) return []
  const k = 2 / (period + 1)
  const result: IndicatorValue[] = []

  let sum = 0
  for (let i = 0; i < period; i++) sum += data[i].close
  let ema = sum / period
  result.push({ time: data[period - 1].time, value: ema })

  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k)
    result.push({ time: data[i].time, value: ema })
  }
  return result
}

export function calcRSI(data: OHLCV[], period = 14): IndicatorValue[] {
  if (data.length < period + 1) return []
  const result: IndicatorValue[] = []

  let avgGain = 0
  let avgLoss = 0

  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close
    if (change >= 0) avgGain += change
    else avgLoss -= change
  }
  avgGain /= period
  avgLoss /= period

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss
  result.push({ time: data[period].time, value: 100 - 100 / (1 + rs) })

  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close
    const gain = change >= 0 ? change : 0
    const loss = change < 0 ? -change : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    result.push({ time: data[i].time, value: 100 - 100 / (1 + rs) })
  }
  return result
}

export function calcMACD(
  data: OHLCV[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): MACDValue[] {
  const emaFast = calcEMA(data, fast)
  const emaSlow = calcEMA(data, slow)
  if (emaFast.length === 0 || emaSlow.length === 0) return []

  // Align by time
  const slowStart = emaSlow[0].time
  const alignedFast = emaFast.filter((e) => e.time >= slowStart)

  const macdLine: { time: number; value: number }[] = []
  for (let i = 0; i < Math.min(alignedFast.length, emaSlow.length); i++) {
    macdLine.push({
      time: emaSlow[i].time,
      value: alignedFast[i].value - emaSlow[i].value,
    })
  }

  if (macdLine.length < signalPeriod) return []

  // Signal line (EMA of MACD)
  const k = 2 / (signalPeriod + 1)
  let signal = 0
  for (let i = 0; i < signalPeriod; i++) signal += macdLine[i].value
  signal /= signalPeriod

  const result: MACDValue[] = []
  result.push({
    time: macdLine[signalPeriod - 1].time,
    macd: macdLine[signalPeriod - 1].value,
    signal,
    histogram: macdLine[signalPeriod - 1].value - signal,
  })

  for (let i = signalPeriod; i < macdLine.length; i++) {
    signal = macdLine[i].value * k + signal * (1 - k)
    result.push({
      time: macdLine[i].time,
      macd: macdLine[i].value,
      signal,
      histogram: macdLine[i].value - signal,
    })
  }
  return result
}

export function calcBollingerBands(data: OHLCV[], period = 20, stdDev = 2): BollingerValue[] {
  const result: BollingerValue[] = []
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = 0; j < period; j++) sum += data[i - j].close
    const middle = sum / period

    let variance = 0
    for (let j = 0; j < period; j++) variance += (data[i - j].close - middle) ** 2
    const sd = Math.sqrt(variance / period)

    result.push({
      time: data[i].time,
      upper: middle + stdDev * sd,
      middle,
      lower: middle - stdDev * sd,
    })
  }
  return result
}

export function calcStochastic(
  data: OHLCV[],
  kPeriod = 14,
  dPeriod = 3
): StochasticValue[] {
  if (data.length < kPeriod) return []

  const kValues: { time: number; k: number }[] = []
  for (let i = kPeriod - 1; i < data.length; i++) {
    let highest = -Infinity
    let lowest = Infinity
    for (let j = 0; j < kPeriod; j++) {
      highest = Math.max(highest, data[i - j].high)
      lowest = Math.min(lowest, data[i - j].low)
    }
    const k = highest === lowest ? 50 : ((data[i].close - lowest) / (highest - lowest)) * 100
    kValues.push({ time: data[i].time, k })
  }

  const result: StochasticValue[] = []
  for (let i = dPeriod - 1; i < kValues.length; i++) {
    let dSum = 0
    for (let j = 0; j < dPeriod; j++) dSum += kValues[i - j].k
    result.push({
      time: kValues[i].time,
      k: kValues[i].k,
      d: dSum / dPeriod,
    })
  }
  return result
}

export function calcATR(data: OHLCV[], period = 14): IndicatorValue[] {
  if (data.length < period + 1) return []

  const trs: number[] = []
  for (let i = 1; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close)
    )
    trs.push(tr)
  }

  let atr = 0
  for (let i = 0; i < period; i++) atr += trs[i]
  atr /= period

  const result: IndicatorValue[] = [{ time: data[period].time, value: atr }]
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period
    result.push({ time: data[i + 1].time, value: atr })
  }
  return result
}

export function calcOBV(data: OHLCV[]): IndicatorValue[] {
  if (data.length < 2) return []
  const result: IndicatorValue[] = [{ time: data[0].time, value: data[0].volume }]
  let obv = data[0].volume

  for (let i = 1; i < data.length; i++) {
    if (data[i].close > data[i - 1].close) obv += data[i].volume
    else if (data[i].close < data[i - 1].close) obv -= data[i].volume
    result.push({ time: data[i].time, value: obv })
  }
  return result
}
