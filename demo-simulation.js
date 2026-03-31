#!/usr/bin/env node
// ============================================================
// TRADING SIMULATION — Zeigt den kompletten Flow des Auto-Traders
// Keine echte IBKR-Verbindung nötig — simuliert alles lokal
// Starten: node demo-simulation.js
// ============================================================

const STARTKAPITAL = 10000  // €10.000 Startkapital

// ── Farben für Terminal ─────────────────────────────────────
const C = {
  green: t => `\x1b[32m${t}\x1b[0m`,
  red: t => `\x1b[31m${t}\x1b[0m`,
  yellow: t => `\x1b[33m${t}\x1b[0m`,
  cyan: t => `\x1b[36m${t}\x1b[0m`,
  bold: t => `\x1b[1m${t}\x1b[0m`,
  dim: t => `\x1b[2m${t}\x1b[0m`,
}

function line(char = '─', len = 60) { return char.repeat(len) }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Yahoo Finance Daten holen ───────────────────────────────
async function fetchOHLCV(symbol, range = '6mo') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  })
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error(`Keine Daten für ${symbol}`)

  const ts = result.timestamp || []
  const q = result.indicators?.quote?.[0]
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

  const meta = result.meta || {}
  return {
    ohlcv,
    price: meta.regularMarketPrice || ohlcv[ohlcv.length - 1]?.close || 0,
    name: meta.shortName || symbol,
    currency: meta.currency || 'USD',
  }
}

// ── Technische Indikatoren (gleiche wie im Auto-Trader) ─────
function calcSMA(data, period) {
  const result = []
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = 0; j < period; j++) sum += data[i - j].close
    result.push(sum / period)
  }
  return result
}

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

function calcRSI(data, period = 14) {
  if (data.length < period + 1) return 50
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close
    if (change >= 0) avgGain += change; else avgLoss -= change
  }
  avgGain /= period; avgLoss /= period
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close
    avgGain = (avgGain * (period - 1) + (change >= 0 ? change : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period
  }
  if (avgLoss === 0) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}

function calcATR(data, period = 14) {
  const trs = []
  for (let i = 1; i < data.length; i++) {
    trs.push(Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close)
    ))
  }
  if (trs.length < period) return 0
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period
  return atr
}

// ── Signal-Analyse (vereinfacht — gleiche Logik wie Auto-Trader)
function analyzeSymbol(ohlcv, symbol) {
  const price = ohlcv[ohlcv.length - 1].close
  const closes = ohlcv.map(d => d.close)

  // Welche Strategie?
  const leveraged = ['TQQQ', 'UPRO', 'SOXL', 'TNA', 'TECL']
  const etfs = ['SPY', 'QQQ', 'VOO', 'VTI', 'DIA', 'IWM']
  let strategy = 'V4 Strict (Aktie)'
  if (leveraged.includes(symbol)) strategy = 'SMA200 (Hebel-ETF)'
  else if (etfs.includes(symbol)) strategy = 'Momentum V2 (ETF)'

  const indicators = {}
  const signals = []

  // SMA200
  if (ohlcv.length >= 200) {
    const sma200 = calcSMA(ohlcv, 200)
    const s200 = sma200[sma200.length - 1]
    indicators.sma200 = s200
    const above200 = price > s200
    signals.push({
      name: 'SMA200',
      value: `$${s200.toFixed(2)}`,
      pass: above200,
      text: above200 ? 'Preis ÜBER SMA200 — Langfristtrend intakt' : 'Preis UNTER SMA200 — Abwärtstrend',
    })
  }

  // SMA50
  if (ohlcv.length >= 50) {
    const sma50 = calcSMA(ohlcv, 50)
    const s50 = sma50[sma50.length - 1]
    indicators.sma50 = s50
    const above50 = price > s50
    signals.push({
      name: 'SMA50',
      value: `$${s50.toFixed(2)}`,
      pass: above50,
      text: above50 ? 'Über SMA50 — Mittelfristtrend positiv' : 'Unter SMA50 — Mittelfristtrend negativ',
    })
  }

  // EMA10 / EMA21 Momentum
  const ema10 = calcEMA(closes, 10)
  const ema21 = calcEMA(closes, 21)
  const e10 = ema10[ema10.length - 1]
  const e10prev = ema10[ema10.length - 2]
  const e21 = ema21[ema21.length - 1]
  indicators.ema10 = e10
  indicators.ema21 = e21
  const momentum = e10 > e10prev && e10 > e21
  signals.push({
    name: 'Momentum',
    value: `EMA10=$${e10.toFixed(2)}`,
    pass: momentum,
    text: momentum ? 'EMA10 > EMA21 und steigend — Momentum!' : 'Kein Momentum',
  })

  // RSI
  const rsi = calcRSI(ohlcv)
  indicators.rsi = rsi
  const rsiGood = rsi > 40 && rsi < 65
  signals.push({
    name: 'RSI',
    value: rsi.toFixed(1),
    pass: rsiGood,
    text: rsi > 80 ? 'ÜBERKAUFT — Verkauf empfohlen' :
          rsi > 65 ? 'Erhöht — kein idealer Einstieg' :
          rsi < 30 ? 'ÜBERVERKAUFT — möglicher Dip-Buy' :
          rsi < 40 ? 'Schwach' :
          'Sweet Spot (40-65) — idealer Einstieg',
  })

  // Distanz zu EMA10
  const distEma = Math.abs(price - e10) / price
  signals.push({
    name: 'Einstieg',
    value: `${(distEma * 100).toFixed(1)}% von EMA10`,
    pass: distEma < 0.025,
    text: distEma < 0.025 ? 'Nah an EMA10 — guter Einstieg' : 'Zu weit von EMA10 — könnte überdehnt sein',
  })

  // ATR (Volatilität)
  const atr = calcATR(ohlcv)
  indicators.atr = atr

  // Gesamtbewertung
  const passed = signals.filter(s => s.pass).length
  const total = signals.length
  let confidence = Math.round((passed / total) * 100)
  let decision = 'HALTEN'
  let decisionColor = C.yellow

  if (strategy.startsWith('SMA200')) {
    // SMA200-Strategie: nur Kreuzungssignale
    const prev = ohlcv[ohlcv.length - 2].close
    const s200 = indicators.sma200
    if (s200) {
      if (price > s200 && prev <= s200) { decision = 'KAUFEN'; confidence = 80; decisionColor = C.green }
      else if (price < s200 && prev >= s200) { decision = 'VERKAUFEN'; confidence = 80; decisionColor = C.red }
      else if (price > s200) { decision = 'HALTEN (bullish)'; confidence = 60; decisionColor = C.yellow }
      else { decision = 'HALTEN (bearish)'; confidence = 40; decisionColor = C.yellow }
    }
  } else {
    if (passed >= 4) { decision = 'KAUFEN'; decisionColor = C.green }
    else if (passed >= 3) { decision = 'HALTEN (knapp)'; decisionColor = C.yellow }
    else if (rsi > 80) { decision = 'VERKAUFEN'; decisionColor = C.red }
    else { decision = 'HALTEN'; decisionColor = C.yellow }
  }

  return { strategy, indicators, signals, passed, total, confidence, decision, decisionColor, price, atr }
}

// ── Haupt-Simulation ────────────────────────────────────────
async function runSimulation() {
  console.log()
  console.log(C.bold('╔══════════════════════════════════════════════════════════╗'))
  console.log(C.bold('║     FINANZANALYSE PRO — TRADING SIMULATION              ║'))
  console.log(C.bold('║     IBKR Broker Integration Demo                        ║'))
  console.log(C.bold('╚══════════════════════════════════════════════════════════╝'))
  console.log()

  // ── SCHRITT 1: Startkapital ───────────────────────────────
  console.log(C.bold('SCHRITT 1: Portfolio-Setup'))
  console.log(line())
  console.log(`  Startkapital:      ${C.green(`€${STARTKAPITAL.toLocaleString('de-DE')}`)}`)
  console.log(`  Broker:            ${C.cyan('Interactive Brokers (IBKR)')}`)
  console.log(`  Gateway:           https://localhost:5000`)
  console.log(`  Max. Positionen:   10`)
  console.log(`  Max. pro Position: 20% des Kapitals`)
  console.log(`  Check-Intervall:   alle 15 Minuten`)
  console.log()

  // ── SCHRITT 2: Watchlist analysieren ──────────────────────
  const watchlist = ['NVDA', 'AAPL', 'TQQQ', 'SAP.DE', 'MSFT']

  console.log(C.bold(`SCHRITT 2: Watchlist analysieren (${watchlist.length} Symbole)`))
  console.log(line())
  console.log()

  const results = []

  for (const symbol of watchlist) {
    process.stdout.write(`  ${C.dim('Lade')} ${C.bold(symbol)} ...`)
    try {
      const data = await fetchOHLCV(symbol)
      const analysis = analyzeSymbol(data.ohlcv, symbol)
      results.push({ symbol, ...data, ...analysis })
      process.stdout.write(` ${C.green('OK')} ($${data.price.toFixed(2)})\n`)
    } catch (err) {
      process.stdout.write(` ${C.red('Fehler')}: ${err.message}\n`)
    }
    await sleep(400) // Rate limit
  }

  console.log()

  // ── SCHRITT 3: Signal-Analyse pro Symbol ──────────────────
  console.log(C.bold('SCHRITT 3: Signal-Analyse'))
  console.log(line('═', 60))

  for (const r of results) {
    console.log()
    console.log(`  ${C.bold(r.symbol)} — ${r.name}`)
    console.log(`  ${C.dim(`Strategie: ${r.strategy}`)}`)
    console.log(`  ${C.dim(`Kurs: $${r.price.toFixed(2)} | ATR: $${r.atr.toFixed(2)} | Volatilität: ${((r.atr / r.price) * 100).toFixed(1)}%`)}`)
    console.log()

    for (const sig of r.signals) {
      const icon = sig.pass ? C.green('✅') : C.red('❌')
      const nameStr = sig.name.padEnd(10)
      console.log(`    ${icon} ${nameStr} ${C.dim(sig.value.padEnd(20))} ${sig.text}`)
    }

    console.log()
    console.log(`    ${C.dim('Konfirmationen:')} ${r.passed}/${r.total}  |  ${C.dim('Konfidenz:')} ${r.confidence}%`)
    console.log(`    ${C.bold('Entscheidung:')} ${r.decisionColor(r.decision)}`)
    console.log(`    ${line('─', 50)}`)
  }

  // ── SCHRITT 4: Trading-Entscheidungen ─────────────────────
  console.log()
  console.log(C.bold('SCHRITT 4: Trading-Ausführung'))
  console.log(line('═', 60))
  console.log()

  let cash = STARTKAPITAL
  const positions = []
  const trades = []

  for (const r of results) {
    if (r.decision !== 'KAUFEN') {
      console.log(`  ${C.dim('⏭️')}  ${r.symbol.padEnd(8)} → ${C.dim(r.decision)} — kein Trade`)
      continue
    }

    // Smart Position Sizing: 2% Risiko pro Trade
    const riskAmount = cash * 0.02
    const stopDistance = r.atr * 2.5
    let quantity = Math.floor(riskAmount / stopDistance)
    const maxInvest = cash * 0.20 // Max 20%
    quantity = Math.min(quantity, Math.floor(maxInvest / r.price))

    if (quantity <= 0 || cash < quantity * r.price) {
      console.log(`  ${C.yellow('⚠️')}  ${r.symbol.padEnd(8)} → Kaufsignal, aber nicht genug Kapital`)
      continue
    }

    const investAmount = quantity * r.price
    const investPercent = ((investAmount / STARTKAPITAL) * 100).toFixed(1)
    const stopPrice = r.price - stopDistance

    console.log()
    console.log(`  ${C.green('🔥 KAUFEN:')} ${C.bold(r.symbol)}`)
    console.log(`    ┌─────────────────────────────────────────────┐`)
    console.log(`    │  Stück:       ${String(quantity).padEnd(32)}│`)
    console.log(`    │  Kurs:        $${r.price.toFixed(2).padEnd(30)}│`)
    console.log(`    │  Investiert:  $${investAmount.toFixed(2).padEnd(30)}│`)
    console.log(`    │  % Portfolio: ${(investPercent + '%').padEnd(31)}│`)
    console.log(`    │  Stop-Loss:   $${stopPrice.toFixed(2)} (${((stopDistance / r.price) * 100).toFixed(1)}% unter Kurs)`.padEnd(50) + '│')
    console.log(`    │  Konfidenz:   ${(r.confidence + '%').padEnd(31)}│`)
    console.log(`    └─────────────────────────────────────────────┘`)

    // IBKR Order Simulation
    console.log()
    console.log(`    ${C.cyan('📡 IBKR Gateway → POST /v1/api/iserver/account/DU123456/orders')}`)
    console.log(`    ${C.cyan(`   { conid: ${10000 + Math.floor(Math.random() * 90000)}, side: "BUY", quantity: ${quantity}, orderType: "MKT" }`)}`)
    await sleep(300)
    console.log(`    ${C.green('✅ IBKR Order bestätigt — Status: Filled')}`)

    cash -= investAmount
    positions.push({ symbol: r.symbol, quantity, entryPrice: r.price, stopPrice })
    trades.push({ symbol: r.symbol, type: 'BUY', quantity, price: r.price })
  }

  // ── SCHRITT 5: Portfolio-Übersicht ────────────────────────
  console.log()
  console.log()
  console.log(C.bold('SCHRITT 5: Portfolio nach Simulation'))
  console.log(line('═', 60))
  console.log()

  let totalInvested = 0
  if (positions.length === 0) {
    console.log(`  ${C.yellow('Keine Kaufsignale heute — alles in Cash')}`)
  } else {
    console.log(`  ${'Symbol'.padEnd(10)} ${'Stück'.padEnd(8)} ${'Kurs'.padEnd(12)} ${'Investiert'.padEnd(14)} ${'Stop-Loss'.padEnd(12)}`)
    console.log(`  ${line('─', 56)}`)
    for (const pos of positions) {
      const inv = pos.quantity * pos.entryPrice
      totalInvested += inv
      console.log(`  ${C.bold(pos.symbol.padEnd(10))} ${String(pos.quantity).padEnd(8)} $${pos.entryPrice.toFixed(2).padEnd(10)} $${inv.toFixed(2).padEnd(12)} $${pos.stopPrice.toFixed(2)}`)
    }
  }

  console.log()
  console.log(`  ${line('─', 56)}`)
  console.log(`  Investiert:  ${C.cyan('$' + totalInvested.toFixed(2))} (${((totalInvested / STARTKAPITAL) * 100).toFixed(1)}%)`)
  console.log(`  Cash:        ${C.green('$' + cash.toFixed(2))} (${((cash / STARTKAPITAL) * 100).toFixed(1)}%)`)
  console.log(`  Gesamt:      ${C.bold('$' + (cash + totalInvested).toFixed(2))}`)
  console.log()

  // ── SCHRITT 6: Was passiert als nächstes? ─────────────────
  console.log(C.bold('WAS PASSIERT JETZT?'))
  console.log(line())
  console.log(`
  Der Auto-Trader prüft alle 15 Minuten:

  ${C.green('📈 Gewinn-Szenario:')}
     Kurs steigt → Trailing Stop wird nachgezogen
     Kurs steigt weiter → Stop steigt mit → Gewinne gesichert
     Kurs dreht → Stop wird getriggert → automatischer Verkauf

  ${C.red('📉 Verlust-Szenario:')}
     Kurs fällt unter Stop-Loss → sofortiger Verkauf
     Maximaler Verlust = 2% des Kapitals pro Trade

  ${C.cyan('🔄 Nächster Check in 15 Minuten...')}
     → Neue Signale für alle ${watchlist.length} Symbole
     → Bestehende Positionen überwachen
     → Stop-Losses aktualisieren
`)

  // ── IBKR Setup-Anleitung ──────────────────────────────────
  console.log(C.bold('IBKR SETUP FÜR LIVE-TRADING:'))
  console.log(line())
  console.log(`
  1. Account erstellen:  interactivebrokers.com
  2. Gateway starten:    Client Portal Gateway (Docker oder lokal)
  3. Im Browser einloggen: https://localhost:5000
  4. Bot konfigurieren:
     ${C.cyan('ibkr.enabled = true')}
     ${C.cyan('ibkr.gatewayUrl = "https://localhost:5000"')}
     ${C.cyan('ibkr.accountId = "DU123456"  ← deine Account-ID')}
  5. Bot starten:  ${C.green('node server.js')}
`)
}

// Los geht's!
runSimulation().catch(err => {
  console.error(C.red('Fehler:'), err.message)
  process.exit(1)
})
