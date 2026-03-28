import type { OHLCV } from '@/types/market'
import type { SignalResult, IndicatorSignal } from '@/types/indicators'
import { calcSMA, calcEMA, calcRSI, calcMACD, calcBollingerBands, calcStochastic } from '../indicators'

export function generateSignals(data: OHLCV[]): SignalResult {
  if (data.length < 50) {
    return {
      direction: 'HOLD',
      confidence: 50,
      score: 0,
      indicators: [],
      timestamp: Date.now(),
    }
  }

  const signals: IndicatorSignal[] = []
  const latest = data[data.length - 1]

  // 1. RSI Signal
  const rsi = calcRSI(data, 14)
  if (rsi.length > 0) {
    const rsiVal = rsi[rsi.length - 1].value
    let signal: IndicatorSignal['signal'] = 'NEUTRAL'
    let reason = `RSI bei ${rsiVal.toFixed(1)}`
    let weight = 0

    if (rsiVal < 30) {
      signal = 'BUY'
      weight = 2
      reason = `RSI bei ${rsiVal.toFixed(1)} — Überverkauft`
    } else if (rsiVal < 40) {
      signal = 'BUY'
      weight = 1
      reason = `RSI bei ${rsiVal.toFixed(1)} — Annähernd überverkauft`
    } else if (rsiVal > 70) {
      signal = 'SELL'
      weight = 2
      reason = `RSI bei ${rsiVal.toFixed(1)} — Überkauft`
    } else if (rsiVal > 60) {
      signal = 'SELL'
      weight = 1
      reason = `RSI bei ${rsiVal.toFixed(1)} — Annähernd überkauft`
    }

    signals.push({ name: 'RSI(14)', value: rsiVal, signal, reason, weight })
  }

  // 2. MACD Signal
  const macd = calcMACD(data, 12, 26, 9)
  if (macd.length >= 2) {
    const cur = macd[macd.length - 1]
    const prev = macd[macd.length - 2]
    let signal: IndicatorSignal['signal'] = 'NEUTRAL'
    let weight = 0
    let reason = `MACD: ${cur.macd.toFixed(3)}`

    if (cur.histogram > 0 && prev.histogram <= 0) {
      signal = 'BUY'
      weight = 2
      reason = 'MACD Histogramm kreuzt nach oben — Bullisches Signal'
    } else if (cur.histogram < 0 && prev.histogram >= 0) {
      signal = 'SELL'
      weight = 2
      reason = 'MACD Histogramm kreuzt nach unten — Bärisches Signal'
    } else if (cur.histogram > 0) {
      signal = 'BUY'
      weight = 1
      reason = `MACD positiv (${cur.histogram.toFixed(3)}) — Aufwärtstrend`
    } else if (cur.histogram < 0) {
      signal = 'SELL'
      weight = 1
      reason = `MACD negativ (${cur.histogram.toFixed(3)}) — Abwärtstrend`
    }

    signals.push({ name: 'MACD(12,26,9)', value: cur.macd, signal, reason, weight })
  }

  // 3. SMA 20/50/200 Trend
  const sma20 = calcSMA(data, 20)
  const sma50 = calcSMA(data, 50)
  const sma200 = calcSMA(data, Math.min(200, data.length - 1))

  if (sma20.length > 0 && sma50.length > 0) {
    const s20 = sma20[sma20.length - 1].value
    const s50 = sma50[sma50.length - 1].value
    const price = latest.close

    let signal: IndicatorSignal['signal'] = 'NEUTRAL'
    let weight = 0
    let reason = `Preis: ${price.toFixed(2)}, SMA20: ${s20.toFixed(2)}, SMA50: ${s50.toFixed(2)}`

    if (price > s20 && s20 > s50) {
      signal = 'BUY'
      weight = 2
      reason = 'Preis über SMA20 > SMA50 — Starker Aufwärtstrend'
    } else if (price > s20) {
      signal = 'BUY'
      weight = 1
      reason = 'Preis über SMA20 — Kurzfristig bullisch'
    } else if (price < s20 && s20 < s50) {
      signal = 'SELL'
      weight = 2
      reason = 'Preis unter SMA20 < SMA50 — Starker Abwärtstrend'
    } else if (price < s20) {
      signal = 'SELL'
      weight = 1
      reason = 'Preis unter SMA20 — Kurzfristig bärisch'
    }

    signals.push({ name: 'SMA Trend', value: s20, signal, reason, weight })
  }

  // 4. SMA 200 (long-term trend)
  if (sma200.length > 0) {
    const s200 = sma200[sma200.length - 1].value
    const price = latest.close
    const signal: IndicatorSignal['signal'] = price > s200 ? 'BUY' : 'SELL'
    const weight = 1

    signals.push({
      name: 'SMA(200)',
      value: s200,
      signal,
      reason: price > s200
        ? `Preis über SMA200 (${s200.toFixed(2)}) — Langfristiger Aufwärtstrend`
        : `Preis unter SMA200 (${s200.toFixed(2)}) — Langfristiger Abwärtstrend`,
      weight,
    })
  }

  // 5. Bollinger Bands
  const bb = calcBollingerBands(data, 20, 2)
  if (bb.length > 0) {
    const bbLast = bb[bb.length - 1]
    const price = latest.close
    const bbWidth = bbLast.upper - bbLast.lower
    const position = (price - bbLast.lower) / bbWidth

    let signal: IndicatorSignal['signal'] = 'NEUTRAL'
    let weight = 0
    let reason = `BB Position: ${(position * 100).toFixed(0)}%`

    if (position < 0.05) {
      signal = 'BUY'
      weight = 2
      reason = `Preis am unteren Bollinger Band — Stark überverkauft`
    } else if (position < 0.2) {
      signal = 'BUY'
      weight = 1
      reason = `Preis nahe unterem Bollinger Band`
    } else if (position > 0.95) {
      signal = 'SELL'
      weight = 2
      reason = `Preis am oberen Bollinger Band — Stark überkauft`
    } else if (position > 0.8) {
      signal = 'SELL'
      weight = 1
      reason = `Preis nahe oberem Bollinger Band`
    }

    signals.push({ name: 'Bollinger(20,2)', value: position * 100, signal, reason, weight })
  }

  // 6. Stochastic
  const stoch = calcStochastic(data, 14, 3)
  if (stoch.length >= 2) {
    const cur = stoch[stoch.length - 1]
    const prev = stoch[stoch.length - 2]

    let signal: IndicatorSignal['signal'] = 'NEUTRAL'
    let weight = 0
    let reason = `%K: ${cur.k.toFixed(1)}, %D: ${cur.d.toFixed(1)}`

    if (cur.k < 20 && cur.k > cur.d && prev.k <= prev.d) {
      signal = 'BUY'
      weight = 2
      reason = 'Stochastik: %K kreuzt %D nach oben im überverkauften Bereich'
    } else if (cur.k < 20) {
      signal = 'BUY'
      weight = 1
      reason = `Stochastik im überverkauften Bereich (${cur.k.toFixed(1)})`
    } else if (cur.k > 80 && cur.k < cur.d && prev.k >= prev.d) {
      signal = 'SELL'
      weight = 2
      reason = 'Stochastik: %K kreuzt %D nach unten im überkauften Bereich'
    } else if (cur.k > 80) {
      signal = 'SELL'
      weight = 1
      reason = `Stochastik im überkauften Bereich (${cur.k.toFixed(1)})`
    }

    signals.push({ name: 'Stochastik(14,3)', value: cur.k, signal, reason, weight })
  }

  // 7. EMA Crossover (12/26)
  const ema12 = calcEMA(data, 12)
  const ema26 = calcEMA(data, 26)
  if (ema12.length >= 2 && ema26.length >= 2) {
    const e12Cur = ema12[ema12.length - 1].value
    const e26Cur = ema26[ema26.length - 1].value
    const e12Prev = ema12[ema12.length - 2].value
    const e26Prev = ema26[ema26.length - 2].value

    let signal: IndicatorSignal['signal'] = 'NEUTRAL'
    let weight = 0
    let reason = `EMA12: ${e12Cur.toFixed(2)}, EMA26: ${e26Cur.toFixed(2)}`

    if (e12Cur > e26Cur && e12Prev <= e26Prev) {
      signal = 'BUY'
      weight = 2
      reason = 'EMA12 kreuzt EMA26 nach oben — Goldenes Kreuz'
    } else if (e12Cur < e26Cur && e12Prev >= e26Prev) {
      signal = 'SELL'
      weight = 2
      reason = 'EMA12 kreuzt EMA26 nach unten — Todeskreuz'
    } else if (e12Cur > e26Cur) {
      signal = 'BUY'
      weight = 1
      reason = 'EMA12 über EMA26 — Bullischer Trend'
    } else {
      signal = 'SELL'
      weight = 1
      reason = 'EMA12 unter EMA26 — Bärischer Trend'
    }

    signals.push({ name: 'EMA Cross(12/26)', value: e12Cur, signal, reason, weight })
  }

  // Calculate overall score
  let totalScore = 0
  let maxScore = 0
  for (const s of signals) {
    maxScore += 2 // max weight per indicator
    if (s.signal === 'BUY') totalScore += s.weight
    else if (s.signal === 'SELL') totalScore -= s.weight
  }

  // Normalize to 0-100 confidence
  const normalizedScore = maxScore > 0 ? totalScore / maxScore : 0 // -1 to 1
  const confidence = Math.round((normalizedScore + 1) * 50) // 0 to 100

  let direction: SignalResult['direction']
  if (normalizedScore > 0.4) direction = 'STRONG_BUY'
  else if (normalizedScore > 0.15) direction = 'BUY'
  else if (normalizedScore > -0.15) direction = 'HOLD'
  else if (normalizedScore > -0.4) direction = 'SELL'
  else direction = 'STRONG_SELL'

  return {
    direction,
    confidence,
    score: totalScore,
    indicators: signals,
    timestamp: Date.now(),
  }
}

export function getSignalColor(direction: SignalResult['direction']): string {
  switch (direction) {
    case 'STRONG_BUY': return '#10b981'
    case 'BUY': return '#34d399'
    case 'HOLD': return '#f59e0b'
    case 'SELL': return '#f87171'
    case 'STRONG_SELL': return '#ef4444'
  }
}

export function getSignalLabel(direction: SignalResult['direction']): string {
  switch (direction) {
    case 'STRONG_BUY': return 'Starker Kauf'
    case 'BUY': return 'Kaufen'
    case 'HOLD': return 'Halten'
    case 'SELL': return 'Verkaufen'
    case 'STRONG_SELL': return 'Starker Verkauf'
  }
}
