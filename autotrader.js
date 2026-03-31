// ============================================================
// AUTO-TRADER ENGINE V3 — Professional-grade trading bot
// Momentum + Sector Rotation + Institutional Detection
// Correlation Analysis + Smart Position Sizing
// ============================================================

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  getEarningsWarning, analyzeSectorStrength, getSectorSignal,
  detectInstitutionalActivity, analyzeRelativeStrength,
  checkWeeklyTrend, calculateSmartPositionSize,
} from './pro-signals.js'
// import { createAlpacaClient, testAlpacaConnection } from './alpaca.js'
import { createIBKRClient } from './ibkr.js'
import { getAIAdvice, analyzeTradeHistory } from './ai-advisor.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_FILE = join(__dirname, 'autotrader-data.json')

// ── Default config ──────────────────────────────────────────
const DEFAULT_CONFIG = {
  enabled: false,
  checkIntervalMinutes: 15,
  initialCapital: 500,
  maxPositionPercent: 'auto',  // 'auto' = passt sich dem Kontostand an
  maxOpenPositions: 'auto',    // 'auto' = skaliert mit Kontostand
  minConfidence: 65,           // Min confidence to buy
  sellConfidence: 40,          // Sell when confidence drops below
  stopLossPercent: 12,         // Hard stop-loss (safety net, trailing stop usually triggers first)
  takeProfitPercent: null,     // V2: No fixed TP — trailing stop lets winners run
  watchlist: [
    // ── IMMER (günstig, ab €500 handelbar) ──
    // Hebel-ETFs (SMA200 Strategie)
    'TQQQ', 'UPRO', 'SOXL', 'TNA',
    // US günstige Aktien
    'SOFI',
    // DAX günstig
    'DTE.DE', 'IFX.DE', 'BAYN.DE', 'MBG.DE', 'BMW.DE', 'VOW3.DE',
    // ── AB €1.000 ──
    'NFLX', 'MSTR',
    // ── AB €2.000 (teurere Aktien) ──
    'NVDA', 'AAPL', 'AMD', 'PLTR', 'COIN',
    'SAP.DE', 'SIE.DE', 'ADS.DE',
    // ── AB €5.000 (Premium) ──
    'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'CRM',
    'ALV.DE', 'ASML.AS',
    // ── AB €10.000 (ETFs & Indizes) ──
    'SPY', 'QQQ', 'VOO', 'VTI', 'DIA', 'IWM',
    'EUNL.DE', 'EXS1.DE',
  ],
  strategy: 'auto',            // 'auto' | 'sma200' | 'v4_strict' | 'momentum_v2'
                               // auto = SMA200 for leveraged ETFs, V4 for stocks, V2 for regular ETFs
  allowedSignals: ['STRONG_BUY', 'BUY'],
  sellSignals: ['STRONG_SELL', 'SELL'],
  // Interactive Brokers (IBKR) broker integration
  ibkr: {
    enabled: false,          // Set to true to execute real trades via IBKR
    gatewayUrl: 'https://localhost:5000',  // IBKR Client Portal Gateway
    accountId: '',           // IBKR Account ID (wird beim Test automatisch ermittelt)
  },
}

// ── Data persistence ────────────────────────────────────────
function loadData() {
  if (existsSync(DATA_FILE)) {
    try {
      return JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
    } catch { /* corrupted, reset */ }
  }
  return {
    config: { ...DEFAULT_CONFIG },
    portfolio: {
      cash: DEFAULT_CONFIG.initialCapital,
      positions: [],     // { symbol, quantity, entryPrice, entryDate, currentPrice }
      totalValue: DEFAULT_CONFIG.initialCapital,
    },
    tradeLog: [],        // { id, symbol, type, quantity, price, date, reason, confidence, pnl }
    lastCheck: null,
    stats: {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalPnL: 0,
      bestTrade: null,
      worstTrade: null,
      startDate: new Date().toISOString(),
    },
  }
}

function saveData(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

// ── Yahoo Finance fetcher (server-side, no CORS) ────────────
async function fetchYahooChart(symbol, range = '6mo', interval = '1d') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  })
  if (!res.ok) throw new Error(`Yahoo ${res.status}`)
  return res.json()
}

function parseOHLCV(data) {
  const result = data?.chart?.result?.[0]
  if (!result) return []
  const ts = result.timestamp || []
  const q = result.indicators?.quote?.[0]
  if (!q) return []
  const ohlcv = []
  for (let i = 0; i < ts.length; i++) {
    if (q.open?.[i] == null || q.close?.[i] == null) continue
    ohlcv.push({
      time: ts[i],
      open: q.open[i],
      high: q.high[i],
      low: q.low[i],
      close: q.close[i],
      volume: q.volume?.[i] || 0,
    })
  }
  return ohlcv
}

function getQuoteFromChart(data, symbol) {
  const result = data?.chart?.result?.[0]
  if (!result) return null
  const meta = result.meta || {}
  return {
    symbol,
    price: meta.regularMarketPrice || 0,
    name: meta.shortName || symbol,
  }
}

// ── Technical indicators (minimal server-side) ──────────────
function calcSMA(data, period) {
  const result = []
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = 0; j < period; j++) sum += data[i - j].close
    result.push(sum / period)
  }
  return result
}

function calcRSI(data, period = 14) {
  if (data.length < period + 1) return 50
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close
    if (change >= 0) avgGain += change
    else avgLoss -= change
  }
  avgGain /= period
  avgLoss /= period
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close
    avgGain = (avgGain * (period - 1) + (change >= 0 ? change : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period
  }
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function calcMACD(data) {
  if (data.length < 35) return { histogram: 0 }
  const ema = (arr, period) => {
    const k = 2 / (period + 1)
    let e = arr.slice(0, period).reduce((a, b) => a + b, 0) / period
    for (let i = period; i < arr.length; i++) e = arr[i] * k + e * (1 - k)
    return e
  }
  const closes = data.map(d => d.close)
  const fast = ema(closes, 12)
  const slow = ema(closes, 26)
  return { histogram: fast - slow }
}

// ── Spike & Pump Detection ──────────────────────────────────
function detectSpike(ohlcv) {
  if (ohlcv.length < 20) return { isSpike: false, reason: '' }

  const latest = ohlcv[ohlcv.length - 1]
  const prev = ohlcv[ohlcv.length - 2]
  const price = latest.close
  const prevClose = prev.close

  // 1. Price spike: >4% move in one day
  const dailyChange = ((price - prevClose) / prevClose) * 100
  if (Math.abs(dailyChange) > 4) {
    return {
      isSpike: true,
      reason: `Tages-Spike von ${dailyChange > 0 ? '+' : ''}${dailyChange.toFixed(1)}% erkannt — Pump&Dump Risiko`,
      dailyChange,
    }
  }

  // 2. Volume spike: today's volume >3x the 20-day average
  const recentVolumes = ohlcv.slice(-21, -1).map(d => d.volume)
  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length
  const volumeRatio = avgVolume > 0 ? latest.volume / avgVolume : 1

  if (volumeRatio > 3 && Math.abs(dailyChange) > 2) {
    return {
      isSpike: true,
      reason: `Ungewöhnliches Volumen (${volumeRatio.toFixed(1)}x Durchschnitt) mit ${dailyChange > 0 ? '+' : ''}${dailyChange.toFixed(1)}% Kursänderung`,
      dailyChange,
      volumeRatio,
    }
  }

  // 3. Gap detection: opening price far from previous close
  const gapPercent = ((latest.open - prevClose) / prevClose) * 100
  if (Math.abs(gapPercent) > 3) {
    return {
      isSpike: true,
      reason: `Gap von ${gapPercent > 0 ? '+' : ''}${gapPercent.toFixed(1)}% bei Eröffnung — abwarten empfohlen`,
      dailyChange,
      gapPercent,
    }
  }

  return { isSpike: false, dailyChange, volumeRatio }
}

// ── Volume confirmation ─────────────────────────────────────
function checkVolumeConfirmation(ohlcv) {
  if (ohlcv.length < 20) return { confirmed: true, reason: '' }

  const latest = ohlcv[ohlcv.length - 1]
  const recentVolumes = ohlcv.slice(-21, -1).map(d => d.volume)
  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length

  if (avgVolume === 0) return { confirmed: true, reason: '' }

  const volumeRatio = latest.volume / avgVolume

  // Very low volume = signal not trustworthy
  if (volumeRatio < 0.3) {
    return {
      confirmed: false,
      reason: `Zu niedriges Volumen (${(volumeRatio * 100).toFixed(0)}% des Durchschnitts) — Signal nicht vertrauenswürdig`,
      volumeRatio,
    }
  }

  // Good volume confirms the signal
  if (volumeRatio > 1.2) {
    return {
      confirmed: true,
      reason: `Volumen bestätigt (${(volumeRatio * 100).toFixed(0)}% des Durchschnitts)`,
      volumeRatio,
    }
  }

  return { confirmed: true, reason: 'Normales Volumen', volumeRatio }
}

// ── EMA calculator ──────────────────────────────────────────
function calcEMA(closes, period) {
  const k = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  const result = [ema]
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k)
    result.push(ema)
  }
  return result
}

// ── ATR calculator ──────────────────────────────────────────
function calcATR(data, period) {
  const trs = []
  for (let i = 1; i < data.length; i++) {
    trs.push(Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close)
    ))
  }
  if (trs.length < period) return []
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
  const result = [atr]
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period
    result.push(atr)
  }
  return result
}

// ── V2 MOMENTUM Signal Generator (with spike protection) ────
// Improvements over V1:
// - EMA10 momentum instead of slow SMA cross
// - Trailing stop based on ATR (adapts to volatility)
// - No fixed take-profit (lets winners run)
// - Partial exit at RSI > 80 with >20% gain
// - Volume confirmation bonus
function generateSignal(ohlcv) {
  if (ohlcv.length < 50) return { direction: 'HOLD', confidence: 50, reasons: [], blocked: false }

  const reasons = []
  const price = ohlcv[ohlcv.length - 1].close

  // ═══ SPIKE PROTECTION (checked first) ═══
  const spike = detectSpike(ohlcv)
  if (spike.isSpike) {
    reasons.push(`⚠️ BLOCKIERT: ${spike.reason}`)
    return { direction: 'HOLD', confidence: 50, reasons, blocked: true, blockReason: spike.reason }
  }

  const volume = checkVolumeConfirmation(ohlcv)
  if (!volume.confirmed) {
    reasons.push(`⚠️ ${volume.reason}`)
    return { direction: 'HOLD', confidence: 45, reasons, blocked: true, blockReason: volume.reason }
  }

  // ═══ V2 MOMENTUM INDICATORS ═══
  let score = 0
  let maxScore = 0

  // 1. EMA10 Momentum (fast trend)
  const closes = ohlcv.map(d => d.close)
  const ema10 = calcEMA(closes, 10)
  const ema10cur = ema10[ema10.length - 1]
  const ema10prev = ema10[ema10.length - 2]
  maxScore += 2
  if (ema10cur > ema10prev && price > ema10cur) {
    score += 2; reasons.push('EMA10 steigend + Preis darüber → Momentum')
  } else if (ema10cur > ema10prev) {
    score += 1; reasons.push('EMA10 steigend')
  } else if (ema10cur < ema10prev && price < ema10cur) {
    score -= 2; reasons.push('EMA10 fallend + Preis darunter')
  } else {
    score -= 1; reasons.push('EMA10 fallend')
  }

  // 2. Trend: Price vs SMA50
  const sma50 = calcSMA(ohlcv, 50)
  const s50 = sma50[sma50.length - 1]
  maxScore += 2
  if (price > s50) {
    score += 2; reasons.push(`Preis über SMA50 (${s50.toFixed(2)}) → Aufwärtstrend`)
  } else {
    score -= 2; reasons.push(`Preis unter SMA50 (${s50.toFixed(2)}) → Abwärtstrend`)
  }

  // 3. RSI sweet spot (40-65 = ideal for momentum entry)
  const rsi = calcRSI(ohlcv, 14)
  maxScore += 2
  if (rsi > 40 && rsi < 65) {
    score += 2; reasons.push(`RSI ${rsi.toFixed(0)} im Sweet Spot (40-65)`)
  } else if (rsi >= 65 && rsi < 80) {
    score += 0; reasons.push(`RSI ${rsi.toFixed(0)} — Momentum, aber erhöht`)
  } else if (rsi >= 80) {
    score -= 2; reasons.push(`RSI ${rsi.toFixed(0)} überkauft → Teilverkauf empfohlen`)
  } else if (rsi < 30) {
    score += 1; reasons.push(`RSI ${rsi.toFixed(0)} überverkauft → möglicher Dip-Buy`)
  } else {
    score -= 1; reasons.push(`RSI ${rsi.toFixed(0)} schwach`)
  }

  // 4. Price near EMA10 (good entry, not chasing)
  const distToEma = Math.abs(price - ema10cur) / price
  maxScore += 1
  if (distToEma < 0.02) {
    score += 1; reasons.push(`Preis nah an EMA10 (${(distToEma * 100).toFixed(1)}%) → guter Einstieg`)
  } else if (distToEma > 0.05) {
    score -= 1; reasons.push(`Preis weit von EMA10 (${(distToEma * 100).toFixed(1)}%) → überdehnt`)
  }

  // 5. MACD direction
  const macd = calcMACD(ohlcv)
  maxScore += 1
  if (macd.histogram > 0) { score += 1; reasons.push('MACD positiv') }
  else { score -= 1; reasons.push('MACD negativ') }

  // 6. SMA200 long-term filter
  if (ohlcv.length >= 200) {
    const sma200 = calcSMA(ohlcv, 200)
    maxScore += 1
    if (sma200.length > 0 && price > sma200[sma200.length - 1]) {
      score += 1; reasons.push('Über SMA200 → Langfristtrend intakt')
    } else {
      score -= 1; reasons.push('Unter SMA200 → Langfristtrend negativ')
    }
  }

  // 7. Volume bonus
  if (volume.volumeRatio > 1.5) {
    const bonus = score > 0 ? 1 : score < 0 ? -1 : 0
    score += bonus
    maxScore += 1
    reasons.push(`Volumen ${volume.volumeRatio.toFixed(1)}x bestätigt Signal`)
  }

  // Calculate ATR for trailing stop info
  const atrArr = calcATR(ohlcv, 14)
  const atr = atrArr.length > 0 ? atrArr[atrArr.length - 1] : price * 0.02

  // ═══ PRO SIGNAL: Institutional Activity ═══
  const institutional = detectInstitutionalActivity(ohlcv)
  if (institutional.detected) {
    score += institutional.boost
    maxScore += 2
    reasons.push(`🏦 ${institutional.reason}`)
  }

  // ═══ PRO SIGNAL: Weekly Trend Confirmation ═══
  const weeklyTrend = checkWeeklyTrend(ohlcv)
  if (weeklyTrend.boost) {
    score += weeklyTrend.boost
    maxScore += 2
    reasons.push(`📅 ${weeklyTrend.reason}`)
  }

  const normalized = maxScore > 0 ? score / maxScore : 0
  const confidence = Math.round((normalized + 1) * 50)

  let direction
  if (normalized > 0.4) direction = 'STRONG_BUY'
  else if (normalized > 0.15) direction = 'BUY'
  else if (normalized > -0.15) direction = 'HOLD'
  else if (normalized > -0.4) direction = 'SELL'
  else direction = 'STRONG_SELL'

  return { direction, confidence, reasons, blocked: false, atr, rsi, weeklyTrend, strategy: 'momentum_v2' }
}

// ── SMA200 SIGNAL (for leveraged ETFs) ──────────────────────
// Simple: above SMA200 = BUY, below = SELL. Few trades, big wins.
function generateSignalSMA200(ohlcv) {
  if (ohlcv.length < 210) return { direction: 'HOLD', confidence: 50, reasons: ['Zu wenig Daten für SMA200'], blocked: false, strategy: 'sma200' }

  const reasons = []
  const price = ohlcv[ohlcv.length - 1].close
  const prevPrice = ohlcv[ohlcv.length - 2].close

  // Spike protection
  const spike = detectSpike(ohlcv)
  if (spike.isSpike) {
    return { direction: 'HOLD', confidence: 50, reasons: [`⚠️ BLOCKIERT: ${spike.reason}`], blocked: true, blockReason: spike.reason, strategy: 'sma200' }
  }

  const sma200 = calcSMA(ohlcv, 200)
  const s200 = sma200[sma200.length - 1]
  const s200prev = sma200[sma200.length - 2]

  const atrArr = calcATR(ohlcv, 14)
  const atr = atrArr.length > 0 ? atrArr[atrArr.length - 1] : price * 0.02

  // Price crosses ABOVE SMA200 → BUY
  if (prevPrice <= s200prev && price > s200) {
    reasons.push(`📈 Preis kreuzt SMA200 nach oben ($${s200.toFixed(2)}) → KAUF-Signal`)
    return { direction: 'STRONG_BUY', confidence: 80, reasons, blocked: false, atr, strategy: 'sma200' }
  }

  // Price crosses BELOW SMA200 → SELL
  if (prevPrice >= s200prev && price < s200) {
    reasons.push(`📉 Preis kreuzt SMA200 nach unten ($${s200.toFixed(2)}) → VERKAUF-Signal`)
    return { direction: 'STRONG_SELL', confidence: 80, reasons, blocked: false, atr, strategy: 'sma200' }
  }

  // Above SMA200 = bullish, below = bearish (but no new signal)
  if (price > s200) {
    reasons.push(`Preis über SMA200 ($${s200.toFixed(2)}) — Position halten`)
    return { direction: 'HOLD', confidence: 60, reasons, blocked: false, atr, strategy: 'sma200' }
  } else {
    reasons.push(`Preis unter SMA200 ($${s200.toFixed(2)}) — keine Position`)
    return { direction: 'HOLD', confidence: 40, reasons, blocked: false, atr, strategy: 'sma200' }
  }
}

// ── V4 STRICTER SIGNAL (for individual stocks) ──────────────
// Needs 4/5 confirmations, wider trailing stop, min 5 day hold
function generateSignalV4(ohlcv) {
  if (ohlcv.length < 210) return { direction: 'HOLD', confidence: 50, reasons: ['Zu wenig Daten'], blocked: false, strategy: 'v4_strict' }

  const reasons = []
  const price = ohlcv[ohlcv.length - 1].close

  // Spike protection
  const spike = detectSpike(ohlcv)
  if (spike.isSpike) {
    return { direction: 'HOLD', confidence: 50, reasons: [`⚠️ BLOCKIERT: ${spike.reason}`], blocked: true, blockReason: spike.reason, strategy: 'v4_strict' }
  }

  const volume = checkVolumeConfirmation(ohlcv)
  if (!volume.confirmed) {
    return { direction: 'HOLD', confidence: 45, reasons: [`⚠️ ${volume.reason}`], blocked: true, blockReason: volume.reason, strategy: 'v4_strict' }
  }

  const closes = ohlcv.map(d => d.close)
  const ema10 = calcEMA(closes, 10)
  const ema21 = calcEMA(closes, 21)
  const sma50 = calcSMA(ohlcv, 50)
  const sma200 = calcSMA(ohlcv, 200)
  const atrArr = calcATR(ohlcv, 14)

  const e10 = ema10[ema10.length - 1]
  const e10prev = ema10[ema10.length - 2]
  const e21val = ema21[ema21.length - 1]
  const s50 = sma50[sma50.length - 1]
  const s200 = sma200[sma200.length - 1]
  const atr = atrArr.length > 0 ? atrArr[atrArr.length - 1] : price * 0.02
  const rsi = calcRSI(ohlcv, 14)

  // Count confirmations (need 4/5 for buy)
  let confirmations = 0

  // 1. Price above SMA200 (long-term uptrend)
  if (price > s200) { confirmations++; reasons.push(`✅ Über SMA200 (${s200.toFixed(2)})`) }
  else { reasons.push(`❌ Unter SMA200 (${s200.toFixed(2)})`) }

  // 2. Price above SMA50 (medium-term)
  if (price > s50) { confirmations++; reasons.push(`✅ Über SMA50 (${s50.toFixed(2)})`) }
  else { reasons.push(`❌ Unter SMA50 (${s50.toFixed(2)})`) }

  // 3. EMA10 rising and above EMA21 (momentum)
  if (e10 > e10prev && e10 > e21val) { confirmations++; reasons.push('✅ EMA10 > EMA21, steigend') }
  else { reasons.push('❌ Kein Momentum (EMA10/21)') }

  // 4. RSI sweet spot
  if (rsi > 40 && rsi < 65) { confirmations++; reasons.push(`✅ RSI ${rsi.toFixed(0)} im Sweet Spot`) }
  else { reasons.push(`❌ RSI ${rsi.toFixed(0)} außerhalb 40-65`) }

  // 5. Price near EMA10 (good entry)
  const distEma = Math.abs(price - e10) / price
  if (distEma < 0.025) { confirmations++; reasons.push(`✅ Nah an EMA10 (${(distEma * 100).toFixed(1)}%)`) }
  else { reasons.push(`❌ Zu weit von EMA10 (${(distEma * 100).toFixed(1)}%)`) }

  reasons.unshift(`Konfirmationen: ${confirmations}/5`)

  // Pro signals
  const institutional = detectInstitutionalActivity(ohlcv)
  if (institutional.detected) reasons.push(`🏦 ${institutional.reason}`)
  const weeklyTrend = checkWeeklyTrend(ohlcv)
  if (weeklyTrend.boost) reasons.push(`📅 ${weeklyTrend.reason}`)

  let direction, confidence
  if (confirmations >= 4) {
    direction = confirmations === 5 ? 'STRONG_BUY' : 'BUY'
    confidence = 55 + confirmations * 8
    if (institutional.detected && institutional.boost > 0) confidence += 5
    if (weeklyTrend.boost > 0) confidence += 5
  } else if (rsi > 75) {
    direction = 'SELL'
    confidence = 35
  } else {
    direction = 'HOLD'
    confidence = 50
  }

  return { direction, confidence: Math.min(100, confidence), reasons, blocked: false, atr, rsi, weeklyTrend, strategy: 'v4_strict', confirmations }
}

// ── MASTER SIGNAL: picks strategy based on symbol type ──────
function generateSignalForSymbol(ohlcv, symbol, strategyOverride) {
  const strategy = strategyOverride || 'auto'

  if (strategy === 'sma200') return generateSignalSMA200(ohlcv)
  if (strategy === 'v4_strict') return generateSignalV4(ohlcv)
  if (strategy === 'momentum_v2') return generateSignal(ohlcv)

  // Auto-detect: leveraged ETFs get SMA200, stocks get V4
  const leveragedETFs = ['TQQQ', 'SQQQ', 'UPRO', 'SPXU', 'SPXL', 'TNA', 'TZA', 'SOXL', 'SOXS', 'LABU', 'LABD', 'FNGU', 'FNGD', 'TECL', 'TECS', 'UDOW', 'SDOW']
  if (leveragedETFs.includes(symbol)) {
    return generateSignalSMA200(ohlcv)
  }

  // Regular ETFs get momentum V2
  const regularETFs = ['SPY', 'QQQ', 'VOO', 'VTI', 'DIA', 'IWM', 'EUNL.DE', 'EXS1.DE', 'VWRL.AS']
  if (regularETFs.includes(symbol)) {
    return generateSignal(ohlcv)
  }

  // Individual stocks get V4 strict
  return generateSignalV4(ohlcv)
}

// ── Trading logic ───────────────────────────────────────────
function executeBuy(data, symbol, price, signal) {
  const { config, portfolio } = data
  const existing = portfolio.positions.find(p => p.symbol === symbol)
  if (existing) return null // Already holding

  const maxPos = config._effectiveMaxPositions || config.maxOpenPositions || 3
  if (portfolio.positions.length >= maxPos) return null

  const maxPct = config._effectiveMaxPositionPct || config.maxPositionPercent || 40
  const maxInvest = portfolio.cash * (maxPct / 100)
  const quantity = Math.floor(maxInvest / price)
  if (quantity <= 0) return null

  const cost = quantity * price
  portfolio.cash -= cost
  portfolio.positions.push({
    symbol,
    quantity,
    entryPrice: price,
    entryDate: new Date().toISOString(),
    currentPrice: price,
    highestPrice: price,  // Track for trailing stop
  })

  const trade = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    symbol,
    type: 'BUY',
    quantity,
    price,
    date: new Date().toISOString(),
    reason: `Signal: ${signal.direction} (${signal.confidence}%) — ${signal.reasons.join(', ')}`,
    confidence: signal.confidence,
    pnl: 0,
  }

  data.tradeLog.unshift(trade)
  data.stats.totalTrades++
  console.log(`[AUTO-TRADE] BUY ${quantity}x ${symbol} @ $${price.toFixed(2)} (${signal.direction} ${signal.confidence}%)`)
  return trade
}

// ── Currency helper: detect symbol currency ─────────────────
// IBKR account is in EUR, US stocks cost USD → IBKR converts automatically
// but we need to account for the ~1.08 EUR/USD rate in position sizing
function getSymbolCurrency(symbol) {
  if (symbol.endsWith('.DE') || symbol.endsWith('.PA')) return 'EUR'
  if (symbol.endsWith('.AS')) return 'EUR'
  if (symbol.endsWith('.SW')) return 'CHF'
  if (symbol.endsWith('.CO')) return 'DKK'
  if (symbol.endsWith('.L')) return 'GBP'
  return 'USD' // Default: US stocks
}

const EUR_USD_RATE = 1.08 // Approximate, IBKR uses live rate

function priceInEUR(price, symbol) {
  const currency = getSymbolCurrency(symbol)
  if (currency === 'EUR') return price
  if (currency === 'USD') return price / EUR_USD_RATE
  if (currency === 'CHF') return price / 0.97  // CHF~EUR
  if (currency === 'GBP') return price / 0.86  // GBP~EUR
  if (currency === 'DKK') return price / 7.46  // DKK~EUR
  return price / EUR_USD_RATE
}

// Get IBKR client if configured
function getIBKRClient(config) {
  if (!config.ibkr?.enabled) return null
  return createIBKRClient(config.ibkr.gatewayUrl)
}

async function executeBuyWithSize(data, symbol, price, signal, smartQuantity) {
  const { config, portfolio } = data
  const existing = portfolio.positions.find(p => p.symbol === symbol)
  if (existing) return null
  const maxPos = config._effectiveMaxPositions || config.maxOpenPositions || 3
  if (portfolio.positions.length >= maxPos) return null

  const ibkr = getIBKRClient(config)
  const costPerShareEUR = priceInEUR(price, symbol)
  const quantity = Math.min(smartQuantity, Math.floor(portfolio.cash / costPerShareEUR))
  if (quantity <= 0) return null

  // ═══ IBKR: Execute real order ═══
  let brokerOrder = null
  let brokerInfo = ''
  if (ibkr && config.ibkr.accountId) {
    try {
      brokerOrder = await ibkr.buyMarket(config.ibkr.accountId, symbol, quantity)
      brokerInfo = ` | IBKR LIVE: Order platziert`
      console.log(`[IBKR] ✅ BUY Order platziert für ${quantity}x ${symbol}`)
    } catch (err) {
      console.error(`[IBKR] ❌ BUY Order fehlgeschlagen: ${err.message}`)
      // CRITICAL: Don't track position if real order failed — prevents paper/live divergence
      return null
    }
  }

  const costEUR = quantity * costPerShareEUR
  portfolio.cash -= costEUR
  const currency = getSymbolCurrency(symbol)
  portfolio.positions.push({
    symbol, quantity, entryPrice: price, currency,
    entryDate: new Date().toISOString(),
    currentPrice: price, highestPrice: price,
  })

  const currencyInfo = currency !== 'EUR' ? ` (≈€${costEUR.toFixed(0)} nach Umrechnung)` : ''
  const trade = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    symbol, type: 'BUY', quantity, price, currency,
    date: new Date().toISOString(),
    reason: `V3 Signal: ${signal.direction} (${signal.confidence}%) — ${signal.reasons.join(', ')}${currencyInfo}${brokerInfo}`,
    confidence: signal.confidence, pnl: 0,
    ibkrOrder: brokerOrder || null,
  }

  data.tradeLog.unshift(trade)
  data.stats.totalTrades++
  console.log(`[AUTO-TRADE V3] BUY ${quantity}x ${symbol} @ ${currency === 'EUR' ? '€' : '$'}${price.toFixed(2)}${currencyInfo} (${signal.direction} ${signal.confidence}%)${brokerInfo}`)
  return trade
}

async function executeSell(data, symbol, price, reason, signal) {
  const { config, portfolio } = data
  const posIdx = portfolio.positions.findIndex(p => p.symbol === symbol)
  if (posIdx === -1) return null

  const pos = portfolio.positions[posIdx]
  const pnl = (price - pos.entryPrice) * pos.quantity
  const pnlPercent = ((price - pos.entryPrice) / pos.entryPrice) * 100

  // ═══ IBKR: Execute real sell order ═══
  const ibkr = getIBKRClient(config)
  if (ibkr && config.ibkr.accountId) {
    try {
      await ibkr.sellAll(config.ibkr.accountId, symbol)
      console.log(`[IBKR] ✅ Verkauf ${symbol} ausgeführt`)
    } catch (err) {
      console.error(`[IBKR] ❌ Verkauf ${symbol} fehlgeschlagen: ${err.message}`)
      // CRITICAL: Don't remove position from paper if real sell failed
      return null
    }
  }

  const sellPriceEUR = priceInEUR(price, symbol)
  portfolio.cash += pos.quantity * sellPriceEUR
  portfolio.positions.splice(posIdx, 1)

  const trade = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    symbol,
    type: 'SELL',
    quantity: pos.quantity,
    price,
    date: new Date().toISOString(),
    reason,
    confidence: signal?.confidence || 0,
    pnl: Math.round(pnl * 100) / 100,
    pnlPercent: Math.round(pnlPercent * 100) / 100,
    holdDays: Math.round((Date.now() - new Date(pos.entryDate).getTime()) / 86400000),
  }

  data.tradeLog.unshift(trade)
  data.stats.totalTrades++
  if (pnl > 0) data.stats.winningTrades++
  else data.stats.losingTrades++
  data.stats.totalPnL = Math.round((data.stats.totalPnL + pnl) * 100) / 100

  if (!data.stats.bestTrade || pnl > data.stats.bestTrade.pnl) data.stats.bestTrade = trade
  if (!data.stats.worstTrade || pnl < data.stats.worstTrade.pnl) data.stats.worstTrade = trade

  console.log(`[AUTO-TRADE] SELL ${pos.quantity}x ${symbol} @ $${price.toFixed(2)} | P&L: $${pnl.toFixed(2)} (${pnlPercent.toFixed(1)}%) | ${reason}`)
  return trade
}

// ── Sektor-Zuordnung für Korrelations-Schutz ────────────────
function getSymbolSector(symbol) {
  const tech = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMD', 'CRM', 'PLTR', 'COIN', 'MSTR', 'SAP.DE', 'IFX.DE', 'ASML.AS']
  const finance = ['ALV.DE', 'SOFI']
  const auto = ['TSLA', 'BMW.DE', 'VOW3.DE', 'MBG.DE']
  const health = ['BAYN.DE']
  const telecom = ['DTE.DE']
  const consumer = ['AMZN', 'NFLX', 'ADS.DE']
  const leveraged = ['TQQQ', 'UPRO', 'SOXL', 'TNA']
  const index = ['SPY', 'QQQ', 'VOO', 'VTI', 'DIA', 'IWM', 'EUNL.DE', 'EXS1.DE']
  if (tech.includes(symbol)) return 'TECH'
  if (finance.includes(symbol)) return 'FINANCE'
  if (auto.includes(symbol)) return 'AUTO'
  if (health.includes(symbol)) return 'HEALTH'
  if (telecom.includes(symbol)) return 'TELECOM'
  if (consumer.includes(symbol)) return 'CONSUMER'
  if (leveraged.includes(symbol)) return 'LEVERAGED'
  if (index.includes(symbol)) return 'INDEX'
  return 'OTHER'
}

// ── Auto-Scaling: passt Config automatisch an Kontostand an ─
function getAutoScale(portfolioValue) {
  if (portfolioValue >= 10000) return { tier: '10k+',  maxPositionPercent: 15, maxOpenPositions: 10 }
  if (portfolioValue >= 5000)  return { tier: '5k+',   maxPositionPercent: 20, maxOpenPositions: 7 }
  if (portfolioValue >= 2000)  return { tier: '2k+',   maxPositionPercent: 25, maxOpenPositions: 5 }
  if (portfolioValue >= 1000)  return { tier: '1k+',   maxPositionPercent: 35, maxOpenPositions: 4 }
  return                              { tier: 'Starter', maxPositionPercent: 40, maxOpenPositions: 3 }
}

// ── Main check cycle ────────────────────────────────────────
async function checkAndTrade() {
  const data = loadData()
  if (!data.config.enabled) {
    console.log('[AUTO-TRADER] Deaktiviert — überspringe')
    return data
  }

  // ═══ AUTO-SCALING: Config an Kontostand anpassen ═══
  const currentValue = data.portfolio.totalValue || data.portfolio.cash
  const autoScale = getAutoScale(currentValue)
  const effectiveMaxPositionPct = data.config.maxPositionPercent === 'auto'
    ? autoScale.maxPositionPercent : data.config.maxPositionPercent
  const effectiveMaxPositions = data.config.maxOpenPositions === 'auto'
    ? autoScale.maxOpenPositions : data.config.maxOpenPositions
  data.config._effectiveMaxPositionPct = effectiveMaxPositionPct
  data.config._effectiveMaxPositions = effectiveMaxPositions

  console.log(`[AUTO-SCALE] Kontostand: €${currentValue.toFixed(0)} → Stufe "${autoScale.tier}" | Max ${effectiveMaxPositions} Positionen à ${effectiveMaxPositionPct}% (€${(currentValue * effectiveMaxPositionPct / 100).toFixed(0)})`)

  // ═══ IBKR: Check gateway auth before trading ═══
  const ibkr = getIBKRClient(data.config)
  if (ibkr) {
    try {
      const auth = await ibkr.checkAuth()
      if (!auth.authenticated) {
        console.log(`[IBKR] ⚠️ Gateway nicht eingeloggt! Bitte https://localhost:5000 öffnen und einloggen.`)
        console.log(`[IBKR] ⚠️ Trading pausiert bis Gateway authentifiziert ist.`)
        data.lastCheck = new Date().toISOString()
        saveData(data)
        return data
      }
      // Keep session alive
      await ibkr.keepAlive()
      console.log(`[IBKR] ✅ Gateway verbunden & authentifiziert`)
    } catch (err) {
      console.log(`[IBKR] ❌ Gateway nicht erreichbar: ${err.message}`)
      console.log(`[IBKR] ⚠️ Trading pausiert — nur Paper-Portfolio wird aktualisiert.`)
    }
  }

  // ═══ EDGE 1: VIX FEAR-FILTER ═══
  let vixLevel = 20 // Default: normal
  let marketFear = 'NORMAL'
  try {
    const vixRaw = await fetchYahooChart('%5EVIX', '5d', '1d')
    const vixOhlcv = parseOHLCV(vixRaw)
    if (vixOhlcv.length > 0) {
      vixLevel = vixOhlcv[vixOhlcv.length - 1].close
      if (vixLevel > 35) marketFear = 'EXTREME'       // Crash-Modus: KEINE Käufe
      else if (vixLevel > 25) marketFear = 'HIGH'      // Vorsicht: Position -50%
      else if (vixLevel < 15) marketFear = 'LOW'        // Ruhig: aggressiver kaufen
      else marketFear = 'NORMAL'
    }
    console.log(`[VIX] ${vixLevel.toFixed(1)} → Angst-Level: ${marketFear}${marketFear === 'EXTREME' ? ' ⚠️ KEINE KÄUFE!' : ''}`)
  } catch { console.log('[VIX] Konnte VIX nicht laden — fahre normal fort') }

  // ═══ EDGE 2: MARKT-REGIME (SPY vs SMA200) ═══
  let marketRegime = 'NEUTRAL'
  let benchmarkOhlcv = []
  try {
    const benchRaw = await fetchYahooChart('SPY', '1y', '1d')
    benchmarkOhlcv = parseOHLCV(benchRaw)
    if (benchmarkOhlcv.length >= 200) {
      const spyPrice = benchmarkOhlcv[benchmarkOhlcv.length - 1].close
      const spySma200 = calcSMA(benchmarkOhlcv, 200)
      const spySma50 = calcSMA(benchmarkOhlcv, 50)
      const s200 = spySma200[spySma200.length - 1]
      const s50 = spySma50[spySma50.length - 1]
      if (spyPrice > s200 && spyPrice > s50) marketRegime = 'BULL'
      else if (spyPrice < s200 && spyPrice < s50) marketRegime = 'BEAR'
      else marketRegime = 'NEUTRAL'
      console.log(`[REGIME] SPY $${spyPrice.toFixed(0)} | SMA50 $${s50.toFixed(0)} | SMA200 $${s200.toFixed(0)} → ${marketRegime}${marketRegime === 'BEAR' ? ' ⚠️ Defensiv-Modus' : ''}`)
    }
  } catch { console.log('[REGIME] Konnte Markt-Regime nicht ermitteln') }

  console.log(`[AUTO-TRADER V3] Prüfe ${data.config.watchlist.length} Symbole...`)

  // ═══ PRO: Fetch sector rotation data ═══
  let sectorStrength = {}
  try {
    sectorStrength = await analyzeSectorStrength(async (sym, range, interval) => {
      const raw = await fetchYahooChart(sym, range, interval)
      return parseOHLCV(raw)
    })
    const strong = Object.entries(sectorStrength).filter(([, v]) => v.strength === 'STRONG').map(([k]) => k)
    const weak = Object.entries(sectorStrength).filter(([, v]) => v.strength === 'AVOID').map(([k]) => k)
    if (strong.length > 0) console.log(`[SEKTOR] Stark: ${strong.join(', ')}`)
    if (weak.length > 0) console.log(`[SEKTOR] Schwach: ${weak.join(', ')}`)
  } catch { console.log('[SEKTOR] Konnte Sektordaten nicht laden') }

  // ═══ PRO: Check earnings season ═══
  const earnings = getEarningsWarning()
  if (earnings.active) console.log(`[EARNINGS] ${earnings.message}`)

  // ═══ EDGE 4: Korrelations-Schutz — Track Sektoren der offenen Positionen ═══
  const sectorCount = {}
  for (const pos of data.portfolio.positions) {
    const sec = getSymbolSector(pos.symbol)
    sectorCount[sec] = (sectorCount[sec] || 0) + 1
  }

  for (const symbol of data.config.watchlist) {
    try {
      const raw = await fetchYahooChart(symbol, '6mo', '1d')
      const ohlcv = parseOHLCV(raw)
      const quote = getQuoteFromChart(raw, symbol)
      if (!quote || quote.price <= 0 || ohlcv.length < 50) continue

      const price = quote.price
      const meta = raw?.chart?.result?.[0]?.meta || {}
      const alreadyHeld = data.portfolio.positions.find(p => p.symbol === symbol)

      // ═══ EDGE 3: Earnings-Kalender — nicht vor Earnings kaufen ═══
      const earningsTs = meta.earningsTimestamp || meta.earningsTimestampStart
      let earningsSoon = false
      if (earningsTs) {
        const daysToEarnings = (earningsTs - Date.now() / 1000) / 86400
        if (daysToEarnings > 0 && daysToEarnings < 3) {
          earningsSoon = true
          if (!alreadyHeld) {
            console.log(`[EARNINGS] ⚠️ ${symbol}: Earnings in ${daysToEarnings.toFixed(0)} Tagen — Kauf blockiert`)
          }
        }
      }

      // ═══ EDGE 5: Pre-Market Gap-Erkennung ═══
      const preMarketPrice = meta.preMarketPrice || 0
      let preMarketGap = 0
      if (preMarketPrice > 0 && ohlcv.length > 0) {
        const lastClose = ohlcv[ohlcv.length - 1].close
        preMarketGap = ((preMarketPrice - lastClose) / lastClose) * 100
      }

      // ═══ AUTO-SCALE: Skip symbols too expensive for current portfolio ═══
      const priceEUR = priceInEUR(price, symbol)
      const maxInvestPerPos = currentValue * (effectiveMaxPositionPct / 100)
      if (!alreadyHeld && priceEUR > maxInvestPerPos) {
        // Can't even buy 1 share in EUR — skip silently
        continue
      }

      const signal = generateSignalForSymbol(ohlcv, symbol, data.config.strategy)

      // ═══ PRO: Add sector rotation signal ═══
      const sectorSignal = getSectorSignal(symbol, sectorStrength)
      if (sectorSignal.boost !== 0) {
        signal.reasons.push(`📊 ${sectorSignal.reason}`)
        // Adjust confidence based on sector
        signal.confidence = Math.max(0, Math.min(100,
          signal.confidence + sectorSignal.boost * 5))
      }

      // ═══ PRO: Add relative strength vs SPY ═══
      if (benchmarkOhlcv.length > 20 && symbol !== 'SPY') {
        const relStrength = analyzeRelativeStrength(ohlcv, benchmarkOhlcv)
        if (relStrength.signal !== 0) {
          signal.reasons.push(`💪 ${relStrength.reason}`)
          signal.confidence = Math.max(0, Math.min(100,
            signal.confidence + relStrength.signal * 4))
        }
      }

      // ═══ SPIKE PROTECTION: Skip this symbol if spike detected ═══
      if (signal.blocked) {
        console.log(`[AUTO-TRADER] ⚠️ ${symbol} BLOCKIERT: ${signal.blockReason}`)
        data.tradeLog.unshift({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          symbol, type: 'BLOCKED', quantity: 0, price,
          date: new Date().toISOString(),
          reason: `🛡️ Spike-Schutz: ${signal.blockReason}`,
          confidence: signal.confidence, pnl: 0,
        })
        continue
      }

      // Update current prices for held positions
      const held = data.portfolio.positions.find(p => p.symbol === symbol)
      if (held) {
        held.currentPrice = price
        if (price > (held.highestPrice || held.entryPrice)) {
          held.highestPrice = price  // Track highest for trailing stop
        }
        const pnlPercent = ((price - held.entryPrice) / held.entryPrice) * 100
        const atr = signal.atr || price * 0.02

        // Trailing Stop: V4=3.5x ATR, SMA200=sell on cross, V2=2.5x ATR
        const trailMultiplier = signal.strategy === 'v4_strict' ? 3.5 : signal.strategy === 'sma200' ? 0 : 2.5
        const trailingStop = trailMultiplier > 0 ? (held.highestPrice || held.entryPrice) - atr * trailMultiplier : 0

        // SMA200 strategy: sell when price crosses below SMA200
        if (signal.strategy === 'sma200' && signal.direction === 'STRONG_SELL') {
          await executeSell(data, symbol, price, `SMA200 Kreuzung nach unten — Hebel-Position geschlossen`, signal)
          continue
        }

        // V4: Minimum 5 day hold (avoid whipsaws)
        if (signal.strategy === 'v4_strict' && held.entryDate) {
          const holdDays = (Date.now() - new Date(held.entryDate).getTime()) / 86400000
          if (holdDays < 5) continue // Don't sell within 5 days
        }

        if (trailingStop > 0 && price <= trailingStop) {
          await executeSell(data, symbol, price, `Trailing Stop ${trailMultiplier}x ATR bei $${trailingStop.toFixed(2)} (Höchst: $${(held.highestPrice || price).toFixed(2)})`, signal)
          continue
        }

        // Hard stop-loss (safety net)
        if (data.config.stopLossPercent && pnlPercent <= -data.config.stopLossPercent) {
          await executeSell(data, symbol, price, `Hard Stop-Loss (-${data.config.stopLossPercent}%) ausgelöst`, signal)
          continue
        }

        // V2: Partial exit at RSI > 80 with >20% gain (sell half, keep half)
        if (signal.rsi && signal.rsi > 80 && pnlPercent > 20 && held.quantity > 1) {
          const sellQty = Math.floor(held.quantity / 2)
          if (sellQty > 0) {
            const pnl = (price - held.entryPrice) * sellQty
            held.quantity -= sellQty
            data.portfolio.cash += sellQty * priceInEUR(price, symbol)
            data.tradeLog.unshift({
              id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
              symbol, type: 'PARTIAL_SELL', quantity: sellQty, price,
              date: new Date().toISOString(),
              reason: `Teilverkauf: RSI ${signal.rsi.toFixed(0)} überkauft + ${pnlPercent.toFixed(1)}% Gewinn → halbe Position gesichert`,
              confidence: signal.confidence,
              pnl: Math.round(pnl * 100) / 100,
              pnlPercent: Math.round(pnlPercent * 100) / 100,
            })
            data.stats.totalTrades++
            data.stats.winningTrades++
            data.stats.totalPnL = Math.round((data.stats.totalPnL + pnl) * 100) / 100
            console.log(`[AUTO-TRADE] PARTIAL SELL ${sellQty}x ${symbol} @ $${price.toFixed(2)} | +${pnlPercent.toFixed(1)}% | RSI ${signal.rsi.toFixed(0)}`)
          }
          continue
        }

        // Trend break: sell signal with low confidence
        if (data.config.sellSignals.includes(signal.direction) && signal.confidence <= data.config.sellConfidence) {
          await executeSell(data, symbol, price, `Signal: ${signal.direction} (${signal.confidence}%) — Trendbruch`, signal)
          continue
        }
      }

      // Check buy signal (V3: momentum + trend + RSI + pro signals)
      if (!held && data.config.allowedSignals.includes(signal.direction) && signal.confidence >= data.config.minConfidence) {

        // ═══ EDGE 1: VIX Fear-Filter ═══
        if (marketFear === 'EXTREME') {
          console.log(`[VIX] ❌ ${symbol}: Kauf blockiert — VIX ${vixLevel.toFixed(0)} (Extreme Fear)`)
          continue
        }
        if (marketFear === 'HIGH') {
          signal.confidence = Math.round(signal.confidence * 0.7) // -30% Konfidenz
          signal.reasons.push(`⚠️ VIX ${vixLevel.toFixed(0)} hoch → Konfidenz reduziert`)
        }
        if (marketFear === 'LOW') {
          signal.confidence = Math.min(100, signal.confidence + 5)
          signal.reasons.push(`✅ VIX ${vixLevel.toFixed(0)} niedrig → leicht aggressiver`)
        }

        // ═══ EDGE 2: Markt-Regime ═══
        if (marketRegime === 'BEAR') {
          signal.confidence = Math.round(signal.confidence * 0.6) // -40% Konfidenz im Bärenmarkt
          signal.reasons.push(`🐻 Bärenmarkt (SPY unter SMA200+50) → Konfidenz stark reduziert`)
          if (signal.confidence < data.config.minConfidence) {
            console.log(`[REGIME] ❌ ${symbol}: Kaufsignal zu schwach im Bärenmarkt (${signal.confidence}%)`)
            continue
          }
        }

        // ═══ EDGE 3: Earnings-Schutz pro Aktie ═══
        if (earningsSoon) {
          console.log(`[EARNINGS] ❌ ${symbol}: Kauf blockiert — Earnings in <3 Tagen`)
          continue
        }

        // ═══ EDGE 4: Korrelations-Schutz ═══
        const sector = getSymbolSector(symbol)
        if (sector !== 'INDEX' && sector !== 'OTHER' && (sectorCount[sector] || 0) >= 2) {
          console.log(`[KORRELATION] ❌ ${symbol}: Bereits 2 Positionen im Sektor ${sector} — überspringe`)
          continue
        }

        // ═══ EDGE 5: Pre-Market Gap ═══
        if (preMarketGap > 5) {
          console.log(`[GAP] ❌ ${symbol}: Pre-Market Gap +${preMarketGap.toFixed(1)}% → nicht dem Hype hinterherkaufen`)
          continue
        }

        // ═══ PRO: Weekly trend must confirm ═══
        if (signal.weeklyTrend && !signal.weeklyTrend.confirmed) {
          console.log(`[AUTO-TRADER] ${symbol}: Kaufsignal, aber Wochentrend bestätigt nicht — überspringe`)
          continue
        }

        // ═══ PRO: Smart position sizing ═══
        const smartSize = calculateSmartPositionSize(
          data.portfolio.cash, price, signal.atr || price * 0.02,
          signal.confidence, earnings
        )
        if (smartSize.quantity > 0) {
          // ═══ AI ADVISOR: Claude prüft den Trade ═══
          const aiAdvice = await getAIAdvice({
            action: 'BUY', symbol, price, signal: signal.direction,
            strategy: signal.strategy, confidence: signal.confidence,
            reasons: signal.reasons, rsi: signal.rsi,
            atr: signal.atr, portfolio: data.portfolio,
            recentTrades: data.tradeLog, earningsActive: earnings.active,
          })

          if (!aiAdvice.approved) {
            console.log(`[AI-ADVISOR] ❌ ${symbol} ABGELEHNT: ${aiAdvice.reason}`)
            data.tradeLog.unshift({
              id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
              symbol, type: 'AI_REJECTED', quantity: 0, price,
              date: new Date().toISOString(),
              reason: `🤖 KI-Berater: ${aiAdvice.reason}`,
              confidence: aiAdvice.adjustedConfidence, pnl: 0,
            })
            continue
          }

          console.log(`[AI-ADVISOR] ✅ ${symbol} GENEHMIGT: ${aiAdvice.reason} (Konfidenz: ${aiAdvice.adjustedConfidence}%)`)
          signal.confidence = aiAdvice.adjustedConfidence
          signal.reasons.push(`🤖 KI: ${aiAdvice.reason}`)
          signal.reasons.push(`📐 ${smartSize.reason}`)
          await executeBuyWithSize(data, symbol, price, signal, smartSize.quantity)
        }
      }

    } catch (err) {
      console.error(`[AUTO-TRADER] Fehler bei ${symbol}:`, err.message)
    }

    // Small delay between API calls
    await new Promise(r => setTimeout(r, 500))
  }

  // Update total portfolio value
  let totalValue = data.portfolio.cash
  for (const pos of data.portfolio.positions) {
    totalValue += (pos.currentPrice || pos.entryPrice) * pos.quantity
  }
  data.portfolio.totalValue = Math.round(totalValue * 100) / 100

  data.lastCheck = new Date().toISOString()
  data.tradeLog = data.tradeLog.slice(0, 200) // Keep last 200 trades
  saveData(data)

  const pnl = totalValue - data.config.initialCapital
  console.log(`[AUTO-TRADER] Fertig | Portfolio: €${totalValue.toFixed(2)} | P&L: €${pnl.toFixed(2)} | Positionen: ${data.portfolio.positions.length}`)

  // ═══ AI: Tägliche Trade-Analyse (einmal pro Tag) ═══
  const today = new Date().toISOString().slice(0, 10)
  if (data.stats.lastAIAnalysis !== today && data.tradeLog.length >= 5) {
    const analysis = await analyzeTradeHistory(data.tradeLog, data.portfolio)
    if (analysis) {
      console.log(`[AI-ADVISOR] 📊 Tägliche Analyse:\n${analysis}`)
      data.stats.lastAIAnalysis = today
      data.stats.lastAIInsight = analysis
    }
  }

  return data
}

// ── API handlers (called from server.js) ────────────────────
export function getAutoTraderData() {
  return loadData()
}

export function updateAutoTraderConfig(newConfig) {
  const data = loadData()
  data.config = { ...data.config, ...newConfig }
  if (newConfig.initialCapital && data.stats.totalTrades === 0) {
    data.portfolio.cash = newConfig.initialCapital
    data.portfolio.totalValue = newConfig.initialCapital
  }
  saveData(data)
  return data
}

export function resetAutoTrader() {
  const data = loadData()
  const config = data.config
  const fresh = {
    config,
    portfolio: { cash: config.initialCapital, positions: [], totalValue: config.initialCapital },
    tradeLog: [],
    lastCheck: null,
    stats: { totalTrades: 0, winningTrades: 0, losingTrades: 0, totalPnL: 0, bestTrade: null, worstTrade: null, startDate: new Date().toISOString() },
  }
  saveData(fresh)
  return fresh
}

export async function runManualCheck() {
  return await checkAndTrade()
}

// ── IBKR Keep-Alive: verhindert Session-Timeout ────────────
let keepAliveId = null

function startIBKRKeepAlive() {
  if (keepAliveId) return // Already running

  // Ping every 5 minutes to keep IBKR session alive
  keepAliveId = setInterval(async () => {
    const data = loadData()
    const ibkr = getIBKRClient(data.config)
    if (!ibkr) return

    try {
      await ibkr.keepAlive()
      const auth = await ibkr.checkAuth()
      if (!auth.authenticated) {
        console.log(`[IBKR-KEEPALIVE] ⚠️ Session abgelaufen — bitte neu einloggen unter ${data.config.ibkr.gatewayUrl}`)
      }
    } catch {
      // Gateway not running — silent
    }
  }, 5 * 60 * 1000) // Every 5 minutes

  console.log('[IBKR-KEEPALIVE] Session-Wächter aktiv (alle 5 Min)')
}

function stopIBKRKeepAlive() {
  if (keepAliveId) {
    clearInterval(keepAliveId)
    keepAliveId = null
  }
}

// ── Interval runner ─────────────────────────────────────────
let intervalId = null

export function startAutoTrader() {
  const data = loadData()
  const minutes = data.config.checkIntervalMinutes || 15
  console.log(`[AUTO-TRADER] Gestartet — prüft alle ${minutes} Minuten`)

  // Start IBKR keep-alive if configured
  if (data.config.ibkr?.enabled) {
    startIBKRKeepAlive()
  }

  // Run immediately on start
  checkAndTrade().catch(err => console.error('[AUTO-TRADER] Error:', err))

  // Then run on interval
  intervalId = setInterval(() => {
    checkAndTrade().catch(err => console.error('[AUTO-TRADER] Error:', err))
  }, minutes * 60 * 1000)
}

export function stopAutoTrader() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  stopIBKRKeepAlive()
  console.log('[AUTO-TRADER] Gestoppt')
}
