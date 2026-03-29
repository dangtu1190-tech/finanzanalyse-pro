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

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_FILE = join(__dirname, 'autotrader-data.json')

// ── Default config ──────────────────────────────────────────
const DEFAULT_CONFIG = {
  enabled: false,
  checkIntervalMinutes: 15,
  initialCapital: 100000,
  maxPositionPercent: 20,      // Max 20% of capital per position
  maxOpenPositions: 10,
  minConfidence: 65,           // Min confidence to buy
  sellConfidence: 40,          // Sell when confidence drops below
  stopLossPercent: 12,         // Hard stop-loss (safety net, trailing stop usually triggers first)
  takeProfitPercent: null,     // V2: No fixed TP — trailing stop lets winners run
  watchlist: [
    // US Indizes & ETFs
    'SPY', 'QQQ', 'VOO', 'VTI', 'DIA', 'IWM',
    // US Top Tech
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA', 'META',
    // US Growth & Momentum
    'AMD', 'PLTR', 'COIN', 'MSTR', 'SOFI', 'CRM', 'NFLX',
    // DAX
    'SAP.DE', 'SIE.DE', 'ALV.DE', 'BMW.DE', 'VOW3.DE', 'MBG.DE', 'DTE.DE', 'ADS.DE', 'IFX.DE', 'BAYN.DE',
    // Europa
    'ASML.AS', 'NESN.SW', 'MC.PA', 'NOVO-B.CO',
    // ETFs Europa
    'EUNL.DE', 'EXS1.DE',
  ],
  allowedSignals: ['STRONG_BUY', 'BUY'],   // Which signals trigger a buy
  sellSignals: ['STRONG_SELL', 'SELL'],      // Which signals trigger a sell
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

  return { direction, confidence, reasons, blocked: false, atr, rsi, weeklyTrend }
}

// ── Trading logic ───────────────────────────────────────────
function executeBuy(data, symbol, price, signal) {
  const { config, portfolio } = data
  const existing = portfolio.positions.find(p => p.symbol === symbol)
  if (existing) return null // Already holding

  if (portfolio.positions.length >= config.maxOpenPositions) return null

  const maxInvest = portfolio.cash * (config.maxPositionPercent / 100)
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

function executeBuyWithSize(data, symbol, price, signal, smartQuantity) {
  const { config, portfolio } = data
  const existing = portfolio.positions.find(p => p.symbol === symbol)
  if (existing) return null
  if (portfolio.positions.length >= config.maxOpenPositions) return null

  const quantity = Math.min(smartQuantity, Math.floor(portfolio.cash / price))
  if (quantity <= 0) return null

  const cost = quantity * price
  portfolio.cash -= cost
  portfolio.positions.push({
    symbol, quantity, entryPrice: price,
    entryDate: new Date().toISOString(),
    currentPrice: price, highestPrice: price,
  })

  const trade = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    symbol, type: 'BUY', quantity, price,
    date: new Date().toISOString(),
    reason: `V3 Signal: ${signal.direction} (${signal.confidence}%) — ${signal.reasons.join(', ')}`,
    confidence: signal.confidence, pnl: 0,
  }

  data.tradeLog.unshift(trade)
  data.stats.totalTrades++
  console.log(`[AUTO-TRADE V3] BUY ${quantity}x ${symbol} @ $${price.toFixed(2)} (${signal.direction} ${signal.confidence}%)`)
  return trade
}

function executeSell(data, symbol, price, reason, signal) {
  const { portfolio } = data
  const posIdx = portfolio.positions.findIndex(p => p.symbol === symbol)
  if (posIdx === -1) return null

  const pos = portfolio.positions[posIdx]
  const pnl = (price - pos.entryPrice) * pos.quantity
  const pnlPercent = ((price - pos.entryPrice) / pos.entryPrice) * 100

  portfolio.cash += pos.quantity * price
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

// ── Main check cycle ────────────────────────────────────────
async function checkAndTrade() {
  const data = loadData()
  if (!data.config.enabled) {
    console.log('[AUTO-TRADER] Deaktiviert — überspringe')
    return data
  }

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

  // ═══ PRO: Fetch benchmark (SPY) for relative strength ═══
  let benchmarkOhlcv = []
  try {
    const benchRaw = await fetchYahooChart('SPY', '6mo', '1d')
    benchmarkOhlcv = parseOHLCV(benchRaw)
  } catch { /* skip */ }

  // ═══ PRO: Check earnings season ═══
  const earnings = getEarningsWarning()
  if (earnings.active) console.log(`[EARNINGS] ${earnings.message}`)

  for (const symbol of data.config.watchlist) {
    try {
      const raw = await fetchYahooChart(symbol, '6mo', '1d')
      const ohlcv = parseOHLCV(raw)
      const quote = getQuoteFromChart(raw, symbol)
      if (!quote || quote.price <= 0 || ohlcv.length < 50) continue

      const signal = generateSignal(ohlcv)
      const price = quote.price

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

        // V2: Trailing Stop (2.5x ATR from highest price)
        const trailingStop = (held.highestPrice || held.entryPrice) - atr * 2.5
        if (price <= trailingStop) {
          executeSell(data, symbol, price, `Trailing Stop bei $${trailingStop.toFixed(2)} (ATR: $${atr.toFixed(2)}, Höchst: $${(held.highestPrice || price).toFixed(2)})`, signal)
          continue
        }

        // Hard stop-loss (safety net)
        if (data.config.stopLossPercent && pnlPercent <= -data.config.stopLossPercent) {
          executeSell(data, symbol, price, `Hard Stop-Loss (-${data.config.stopLossPercent}%) ausgelöst`, signal)
          continue
        }

        // V2: Partial exit at RSI > 80 with >20% gain (sell half, keep half)
        if (signal.rsi && signal.rsi > 80 && pnlPercent > 20 && held.quantity > 1) {
          const sellQty = Math.floor(held.quantity / 2)
          if (sellQty > 0) {
            const pnl = (price - held.entryPrice) * sellQty
            held.quantity -= sellQty
            data.portfolio.cash += sellQty * price
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
          executeSell(data, symbol, price, `Signal: ${signal.direction} (${signal.confidence}%) — Trendbruch`, signal)
          continue
        }
      }

      // Check buy signal (V3: momentum + trend + RSI + pro signals)
      if (!held && data.config.allowedSignals.includes(signal.direction) && signal.confidence >= data.config.minConfidence) {
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
          // Override the default buy with smart sizing
          signal.reasons.push(`📐 ${smartSize.reason}`)
          executeBuyWithSize(data, symbol, price, signal, smartSize.quantity)
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
  console.log(`[AUTO-TRADER] Fertig | Portfolio: $${totalValue.toFixed(2)} | P&L: $${pnl.toFixed(2)} | Positionen: ${data.portfolio.positions.length}`)

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

// ── Interval runner ─────────────────────────────────────────
let intervalId = null

export function startAutoTrader() {
  const data = loadData()
  const minutes = data.config.checkIntervalMinutes || 15
  console.log(`[AUTO-TRADER] Gestartet — prüft alle ${minutes} Minuten`)

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
    console.log('[AUTO-TRADER] Gestoppt')
  }
}
