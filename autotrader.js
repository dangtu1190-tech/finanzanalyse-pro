// ============================================================
// AUTO-TRADER ENGINE — Runs on the server every 15 minutes
// Checks watchlist, generates signals, executes paper trades
// ============================================================

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

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
  stopLossPercent: 8,          // Auto stop-loss
  takeProfitPercent: 15,       // Auto take-profit
  watchlist: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA', 'META', 'SPY', 'QQQ'],
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

// ── Signal generator (simplified for server) ────────────────
function generateSignal(ohlcv) {
  if (ohlcv.length < 50) return { direction: 'HOLD', confidence: 50, reasons: [] }

  let score = 0
  let maxScore = 0
  const reasons = []
  const price = ohlcv[ohlcv.length - 1].close

  // RSI
  const rsi = calcRSI(ohlcv, 14)
  maxScore += 2
  if (rsi < 30) { score += 2; reasons.push(`RSI ${rsi.toFixed(0)} überverkauft`) }
  else if (rsi < 40) { score += 1; reasons.push(`RSI ${rsi.toFixed(0)} niedrig`) }
  else if (rsi > 70) { score -= 2; reasons.push(`RSI ${rsi.toFixed(0)} überkauft`) }
  else if (rsi > 60) { score -= 1; reasons.push(`RSI ${rsi.toFixed(0)} hoch`) }

  // SMA 20/50
  const sma20 = calcSMA(ohlcv, 20)
  const sma50 = calcSMA(ohlcv, 50)
  maxScore += 2
  if (sma20.length > 0 && sma50.length > 0) {
    const s20 = sma20[sma20.length - 1]
    const s50 = sma50[sma50.length - 1]
    if (price > s20 && s20 > s50) { score += 2; reasons.push('Preis > SMA20 > SMA50') }
    else if (price > s20) { score += 1; reasons.push('Preis > SMA20') }
    else if (price < s20 && s20 < s50) { score -= 2; reasons.push('Preis < SMA20 < SMA50') }
    else if (price < s20) { score -= 1; reasons.push('Preis < SMA20') }
  }

  // MACD
  const macd = calcMACD(ohlcv)
  maxScore += 2
  if (macd.histogram > 0) { score += 1; reasons.push('MACD positiv') }
  else { score -= 1; reasons.push('MACD negativ') }

  // SMA 200
  if (ohlcv.length >= 200) {
    const sma200 = calcSMA(ohlcv, 200)
    maxScore += 1
    if (sma200.length > 0 && price > sma200[sma200.length - 1]) {
      score += 1; reasons.push('Über SMA200')
    } else {
      score -= 1; reasons.push('Unter SMA200')
    }
  }

  const normalized = maxScore > 0 ? score / maxScore : 0
  const confidence = Math.round((normalized + 1) * 50)

  let direction
  if (normalized > 0.4) direction = 'STRONG_BUY'
  else if (normalized > 0.15) direction = 'BUY'
  else if (normalized > -0.15) direction = 'HOLD'
  else if (normalized > -0.4) direction = 'SELL'
  else direction = 'STRONG_SELL'

  return { direction, confidence, reasons }
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

  console.log(`[AUTO-TRADER] Prüfe ${data.config.watchlist.length} Symbole...`)

  for (const symbol of data.config.watchlist) {
    try {
      const raw = await fetchYahooChart(symbol, '6mo', '1d')
      const ohlcv = parseOHLCV(raw)
      const quote = getQuoteFromChart(raw, symbol)
      if (!quote || quote.price <= 0 || ohlcv.length < 50) continue

      const signal = generateSignal(ohlcv)
      const price = quote.price

      // Update current prices for held positions
      const held = data.portfolio.positions.find(p => p.symbol === symbol)
      if (held) {
        held.currentPrice = price
        const pnlPercent = ((price - held.entryPrice) / held.entryPrice) * 100

        // Check stop-loss
        if (data.config.stopLossPercent && pnlPercent <= -data.config.stopLossPercent) {
          executeSell(data, symbol, price, `Stop-Loss (-${data.config.stopLossPercent}%) ausgelöst`, signal)
          continue
        }

        // Check take-profit
        if (data.config.takeProfitPercent && pnlPercent >= data.config.takeProfitPercent) {
          executeSell(data, symbol, price, `Take-Profit (+${data.config.takeProfitPercent}%) erreicht`, signal)
          continue
        }

        // Check sell signal
        if (data.config.sellSignals.includes(signal.direction) && signal.confidence <= data.config.sellConfidence) {
          executeSell(data, symbol, price, `Signal: ${signal.direction} (${signal.confidence}%)`, signal)
          continue
        }
      }

      // Check buy signal
      if (!held && data.config.allowedSignals.includes(signal.direction) && signal.confidence >= data.config.minConfidence) {
        executeBuy(data, symbol, price, signal)
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
