import type { OHLCV } from '@/types/market'
import type { SignalResult } from '@/types/indicators'
import { calcSMA, calcATR, calcRSI, calcBollingerBands } from '../indicators'

export interface AnalysisReport {
  summary: string
  trend: string
  recommendation: string
  entryPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  riskRewardRatio: number | null
  positionSizing: string
  keyLevels: { label: string; price: number }[]
  warnings: string[]
  detailSections: { title: string; text: string }[]
}

export function generateAnalysisReport(
  symbol: string,
  data: OHLCV[],
  signal: SignalResult
): AnalysisReport {
  if (data.length < 50) {
    return emptyReport('Nicht genügend Daten für eine fundierte Analyse. Mindestens 50 Datenpunkte erforderlich.')
  }

  const latest = data[data.length - 1]
  const price = latest.close

  // Calculate key levels
  const sma20 = calcSMA(data, 20)
  const sma50 = calcSMA(data, 50)
  const sma200 = calcSMA(data, Math.min(200, data.length - 1))
  const atr = calcATR(data, 14)
  const rsi = calcRSI(data, 14)
  const bb = calcBollingerBands(data, 20, 2)

  const atrValue = atr.length > 0 ? atr[atr.length - 1].value : price * 0.02
  const rsiValue = rsi.length > 0 ? rsi[rsi.length - 1].value : 50
  const sma20Val = sma20.length > 0 ? sma20[sma20.length - 1].value : price
  const sma50Val = sma50.length > 0 ? sma50[sma50.length - 1].value : price
  const sma200Val = sma200.length > 0 ? sma200[sma200.length - 1].value : price
  const bbLast = bb.length > 0 ? bb[bb.length - 1] : null

  // Support / Resistance from recent highs/lows
  const recent30 = data.slice(-30)
  const recentHigh = Math.max(...recent30.map(d => d.high))
  const recentLow = Math.min(...recent30.map(d => d.low))

  // Trend determination
  const trendParts: string[] = []
  let trendStrength = 0

  if (price > sma200Val) { trendParts.push('über dem SMA200 (langfristig bullisch)'); trendStrength++ }
  else { trendParts.push('unter dem SMA200 (langfristig bärisch)'); trendStrength-- }

  if (price > sma50Val) { trendParts.push('über dem SMA50 (mittelfristig bullisch)'); trendStrength++ }
  else { trendParts.push('unter dem SMA50 (mittelfristig bärisch)'); trendStrength-- }

  if (price > sma20Val) { trendParts.push('über dem SMA20 (kurzfristig bullisch)'); trendStrength++ }
  else { trendParts.push('unter dem SMA20 (kurzfristig bärisch)'); trendStrength-- }

  const trendLabel = trendStrength >= 2 ? 'Starker Aufwärtstrend'
    : trendStrength >= 1 ? 'Moderater Aufwärtstrend'
    : trendStrength === 0 ? 'Seitwärtsbewegung / Neutral'
    : trendStrength >= -1 ? 'Moderater Abwärtstrend'
    : 'Starker Abwärtstrend'

  // Entry, Stop-Loss, Take-Profit
  const isBuy = signal.direction === 'STRONG_BUY' || signal.direction === 'BUY'
  const isSell = signal.direction === 'STRONG_SELL' || signal.direction === 'SELL'

  let entryPrice: number | null = null
  let stopLoss: number | null = null
  let takeProfit: number | null = null

  if (isBuy) {
    entryPrice = round(price)
    stopLoss = round(price - atrValue * 2)
    takeProfit = round(price + atrValue * 3)
  } else if (isSell) {
    entryPrice = round(price)
    stopLoss = round(price + atrValue * 2)
    takeProfit = round(price - atrValue * 3)
  }

  const riskRewardRatio = (entryPrice && stopLoss && takeProfit)
    ? round(Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss))
    : null

  // Key Levels
  const keyLevels: { label: string; price: number }[] = [
    { label: 'Aktueller Preis', price: round(price) },
    { label: 'Widerstand (30T Hoch)', price: round(recentHigh) },
    { label: 'Unterstützung (30T Tief)', price: round(recentLow) },
    { label: 'SMA 20', price: round(sma20Val) },
    { label: 'SMA 50', price: round(sma50Val) },
    { label: 'SMA 200', price: round(sma200Val) },
  ]
  if (bbLast) {
    keyLevels.push({ label: 'Bollinger Oben', price: round(bbLast.upper) })
    keyLevels.push({ label: 'Bollinger Unten', price: round(bbLast.lower) })
  }

  // Warnings
  const warnings: string[] = []
  if (rsiValue > 70) warnings.push('RSI zeigt überkauften Bereich — Rücksetzer möglich')
  if (rsiValue < 30) warnings.push('RSI zeigt überverkauften Bereich — Erholung möglich')
  if (atrValue / price > 0.04) warnings.push('Hohe Volatilität — erhöhtes Risiko bei Positionierung')
  if (signal.direction === 'HOLD') warnings.push('Kein klares Signal — abwarten empfohlen')
  if (bbLast && price > bbLast.upper) warnings.push('Preis über oberem Bollinger Band — mögliche Überdehnung')
  if (bbLast && price < bbLast.lower) warnings.push('Preis unter unterem Bollinger Band — möglicher Ausverkauf')

  // Volatility description
  const volPercent = (atrValue / price) * 100
  const volLabel = volPercent > 4 ? 'sehr hoch' : volPercent > 2.5 ? 'hoch' : volPercent > 1.5 ? 'moderat' : 'niedrig'

  // Position sizing suggestion
  const riskPercent = 2
  const accountSize = 10000
  const riskAmount = accountSize * (riskPercent / 100)
  const shareRisk = entryPrice && stopLoss ? Math.abs(entryPrice - stopLoss) : atrValue * 2
  const positionSize = Math.floor(riskAmount / shareRisk)
  const positionSizing = `Bei einem Konto von $${accountSize.toLocaleString('de-DE')} und ${riskPercent}% Risiko pro Trade: max. ${positionSize} Anteile (Risiko: $${round(shareRisk)}/Anteil)`

  // Build summary
  const directionText = isBuy ? 'Kaufempfehlung' : isSell ? 'Verkaufsempfehlung' : 'Neutral — Abwarten'

  const summary = buildSummary(symbol, price, signal, trendLabel, rsiValue, atrValue, volLabel, isBuy, isSell, entryPrice, stopLoss, takeProfit, riskRewardRatio)

  // Detail sections
  const detailSections = [
    {
      title: 'Trendanalyse',
      text: `${symbol} befindet sich derzeit in einem ${trendLabel.toLowerCase()}. Der Kurs notiert ${trendParts.join(', ')}. ${
        sma20Val > sma50Val
          ? 'Der SMA20 liegt über dem SMA50, was eine bullische Struktur bestätigt.'
          : 'Der SMA20 liegt unter dem SMA50, was auf Schwäche hindeutet.'
      }`,
    },
    {
      title: 'Momentum & RSI',
      text: `Der RSI(14) steht bei ${rsiValue.toFixed(1)}. ${
        rsiValue > 70 ? 'Dies deutet auf einen überkauften Zustand hin — kurzfristige Rücksetzer sind wahrscheinlich.'
        : rsiValue > 60 ? 'Das Momentum ist positiv, aber noch nicht im extremen Bereich.'
        : rsiValue > 40 ? 'Das Momentum ist neutral — kein starker Kauf- oder Verkaufsdruck erkennbar.'
        : rsiValue > 30 ? 'Das Momentum ist schwach, nähert sich aber dem überverkauften Bereich.'
        : 'Dies deutet auf einen überverkauften Zustand hin — eine technische Erholung wird wahrscheinlicher.'
      }`,
    },
    {
      title: 'Volatilität',
      text: `Die Volatilität (ATR-14) beträgt $${atrValue.toFixed(2)} (${volPercent.toFixed(1)}% des Kurses) und ist damit ${volLabel}. ${
        volLabel === 'sehr hoch' || volLabel === 'hoch'
          ? 'Bei erhöhter Volatilität sollten Positionen kleiner gehalten und Stop-Loss weiter gesetzt werden.'
          : 'Die moderate Volatilität erlaubt engere Stop-Loss-Levels.'
      }`,
    },
    {
      title: 'Signal-Konfluenz',
      text: `${signal.indicators.filter(i => i.signal === 'BUY').length} von ${signal.indicators.length} Indikatoren zeigen Kaufsignale, ${signal.indicators.filter(i => i.signal === 'SELL').length} zeigen Verkaufssignale. Die Gesamtkonfidenz liegt bei ${signal.confidence}%. ${
        signal.confidence > 70 ? 'Dies ist ein starkes, zuverlässiges Signal.'
        : signal.confidence > 50 ? 'Das Signal hat moderate Stärke — zusätzliche Bestätigung empfohlen.'
        : 'Das Signal ist schwach — besser abwarten oder nur mit reduzierter Position handeln.'
      }`,
    },
  ]

  return {
    summary,
    trend: trendLabel,
    recommendation: directionText,
    entryPrice,
    stopLoss,
    takeProfit,
    riskRewardRatio,
    positionSizing,
    keyLevels,
    warnings,
    detailSections,
  }
}

function buildSummary(
  symbol: string, price: number, signal: SignalResult,
  trendLabel: string, rsi: number, atr: number, volLabel: string,
  isBuy: boolean, isSell: boolean,
  entry: number | null, sl: number | null, tp: number | null, rr: number | null
): string {
  const parts: string[] = []

  parts.push(`**${symbol}** notiert aktuell bei $${price.toFixed(2)} in einem ${trendLabel.toLowerCase()}.`)

  if (isBuy) {
    parts.push(`Die technische Analyse ergibt eine **Kaufempfehlung** mit ${signal.confidence}% Konfidenz.`)
    if (entry && sl && tp) {
      parts.push(`Empfohlener Einstieg bei $${entry.toFixed(2)}, Stop-Loss bei $${sl.toFixed(2)}, Kursziel bei $${tp.toFixed(2)} (Chance/Risiko: ${rr?.toFixed(1)}:1).`)
    }
  } else if (isSell) {
    parts.push(`Die technische Analyse ergibt eine **Verkaufsempfehlung** mit ${signal.confidence}% Konfidenz.`)
    if (entry && sl && tp) {
      parts.push(`Empfohlener Ausstieg bei $${entry.toFixed(2)}, Stop-Loss bei $${sl.toFixed(2)}, Kursziel bei $${tp.toFixed(2)}.`)
    }
  } else {
    parts.push(`Derzeit ergibt sich **kein klares Signal** (Konfidenz: ${signal.confidence}%). Abwarten empfohlen.`)
  }

  parts.push(`Die Volatilität ist ${volLabel} (ATR: $${atr.toFixed(2)}).`)

  return parts.join(' ')
}

function emptyReport(msg: string): AnalysisReport {
  return {
    summary: msg, trend: 'Unbekannt', recommendation: 'Keine Daten',
    entryPrice: null, stopLoss: null, takeProfit: null, riskRewardRatio: null,
    positionSizing: '', keyLevels: [], warnings: [], detailSections: [],
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
