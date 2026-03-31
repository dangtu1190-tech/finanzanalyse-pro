// Backtest V4: Improved strategies for both leveraged ETFs and individual stocks

const LEVERAGED = ['TQQQ', 'UPRO', 'SOXL', 'TNA']
const STOCKS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'TSLA', 'META', 'AMD', 'NFLX', 'COIN', 'CRM']

async function fetchData(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5y`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const data = await res.json()
  const result = data?.chart?.result?.[0]
  if (!result) return []
  const ts = result.timestamp || []
  const q = result.indicators?.quote?.[0]
  if (!q) return []
  const ohlcv = []
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null) continue
    ohlcv.push({ time: ts[i], close: q.close[i], high: q.high[i], low: q.low[i], open: q.open[i], volume: q.volume?.[i] || 0 })
  }
  return ohlcv
}

function calcSMA(data, period) {
  const r = []
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0; for (let j = 0; j < period; j++) sum += data[i - j].close
    r.push(sum / period)
  }
  return r
}

function calcEMA(closes, period) {
  const k = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  const result = [ema]
  for (let i = period; i < closes.length; i++) { ema = closes[i] * k + ema * (1 - k); result.push(ema) }
  return result
}

function calcRSI(data, period) {
  if (data.length < period + 1) return 50
  let ag = 0, al = 0
  for (let i = 1; i <= period; i++) { const c = data[i].close - data[i - 1].close; if (c >= 0) ag += c; else al -= c }
  ag /= period; al /= period
  for (let i = period + 1; i < data.length; i++) {
    const c = data[i].close - data[i - 1].close
    ag = (ag * (period - 1) + (c >= 0 ? c : 0)) / period
    al = (al * (period - 1) + (c < 0 ? -c : 0)) / period
  }
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al)
}

function calcATR(data, period) {
  const trs = []
  for (let i = 1; i < data.length; i++) {
    trs.push(Math.max(data[i].high - data[i].low, Math.abs(data[i].high - data[i - 1].close), Math.abs(data[i].low - data[i - 1].close)))
  }
  if (trs.length < period) return []
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
  const result = [atr]
  for (let i = period; i < trs.length; i++) { atr = (atr * (period - 1) + trs[i]) / period; result.push(atr) }
  return result
}

// ════════════════════════════════════════════════════════
// STRATEGY: SMA200 for leveraged ETFs (few trades, big wins)
// Buy when price crosses ABOVE SMA200
// Sell when price crosses BELOW SMA200
// That's it. Simple = better for leveraged.
// ════════════════════════════════════════════════════════
function strategySMA200(data, capital) {
  let cash = capital, pos = 0, entry = 0
  let trades = 0, wins = 0, losses = 0, peak = capital, maxDD = 0
  const sma200 = calcSMA(data, 200)
  const off = data.length - sma200.length

  for (let i = 201; i < data.length; i++) {
    const price = data[i].close
    const prevPrice = data[i - 1].close
    const s200 = sma200[i - off]
    const s200prev = sma200[i - off - 1]
    if (!s200 || !s200prev) continue

    const equity = pos > 0 ? cash + pos * price : cash
    if (equity > peak) peak = equity
    if ((peak - equity) / peak > maxDD) maxDD = (peak - equity) / peak

    // Buy: price crosses above SMA200
    if (pos === 0 && prevPrice <= s200prev && price > s200) {
      pos = Math.floor((cash * 0.95) / price)
      if (pos > 0) { entry = price; cash -= pos * price; trades++ }
    }

    // Sell: price crosses below SMA200
    if (pos > 0 && prevPrice >= s200prev && price < s200) {
      cash += pos * price
      if (price > entry) wins++; else losses++
      pos = 0
    }
  }
  if (pos > 0) { cash += pos * data[data.length - 1].close; if (data[data.length - 1].close > entry) wins++; else losses++ }
  const bh = (data[data.length - 1].close - data[201].close) / data[201].close * 100
  return { finalVal: cash, returnPct: (cash - capital) / capital * 100, trades, wins, losses, maxDD: maxDD * 100, buyHold: bh }
}

// ════════════════════════════════════════════════════════
// STRATEGY V4: Improved momentum for individual stocks
// Key changes vs V2:
// 1. WIDER trailing stop (3.5x ATR instead of 2.5x)
// 2. FEWER entries (need 3+ confirmations, not just 2)
// 3. NO partial exits (let winners run fully)
// 4. Minimum holding period (5 days — avoid whipsaws)
// ════════════════════════════════════════════════════════
function strategyV4(data, capital) {
  let cash = capital, pos = 0, entry = 0, highest = 0, entryDay = 0
  let trades = 0, wins = 0, losses = 0, peak = capital, maxDD = 0
  const closes = data.map(d => d.close)
  const ema10 = calcEMA(closes, 10); const ema10off = data.length - ema10.length
  const ema21 = calcEMA(closes, 21); const ema21off = data.length - ema21.length
  const sma50 = calcSMA(data, 50); const sma50off = data.length - sma50.length
  const sma200 = calcSMA(data, 200); const sma200off = data.length - sma200.length
  const atrArr = calcATR(data, 14); const atrOff = data.length - atrArr.length - 1

  for (let i = 200; i < data.length; i++) {
    const price = data[i].close
    if (i > 0 && Math.abs((price - data[i - 1].close) / data[i - 1].close * 100) > 6) continue
    const equity = pos > 0 ? cash + pos * price : cash
    if (equity > peak) peak = equity
    if ((peak - equity) / peak > maxDD) maxDD = (peak - equity) / peak

    const e10 = ema10[i - ema10off]; const e10prev = ema10[i - ema10off - 1]
    const e21 = ema21[i - ema21off]
    const s50 = sma50[i - sma50off]
    const s200 = sma200[i - sma200off]
    const atrIdx = i - atrOff - 1; const atr = atrIdx >= 0 ? atrArr[atrIdx] : price * 0.02
    if (!e10 || !s50 || !s200) continue

    const rsi = calcRSI(data.slice(Math.max(0, i - 20), i + 1), 14)

    // ── BUY: Need 3+ confirmations ──
    if (pos === 0) {
      let confirmations = 0
      const reasons = []

      // 1. Price above SMA200 (long-term uptrend)
      if (price > s200) { confirmations++; reasons.push('trend') }
      // 2. Price above SMA50 (medium-term)
      if (price > s50) { confirmations++; reasons.push('mid') }
      // 3. EMA10 rising and above EMA21 (momentum)
      if (e10 > e10prev && e10 > e21) { confirmations++; reasons.push('momentum') }
      // 4. RSI in sweet spot (not overbought)
      if (rsi > 40 && rsi < 65) { confirmations++; reasons.push('rsi') }
      // 5. Price near EMA10 (good entry, not chasing)
      if (Math.abs(price - e10) / price < 0.025) { confirmations++; reasons.push('entry') }

      // Need at least 4 out of 5
      if (confirmations >= 4) {
        pos = Math.floor((cash * 0.95) / price)
        if (pos > 0) { entry = price; highest = price; entryDay = i; cash -= pos * price; trades++ }
      }
    }

    // ── SELL ──
    if (pos > 0) {
      if (price > highest) highest = price

      // Minimum hold: 5 days (avoid whipsaws)
      if (i - entryDay < 5) continue

      // Trailing stop: 3.5x ATR (wider = less whipsaws)
      const trailStop = highest - atr * 3.5
      // Hard stop: -15%
      const hardStop = entry * 0.85
      // Trend break: below SMA200
      const trendDead = price < s200

      if (price <= trailStop || price <= hardStop || trendDead) {
        cash += pos * price
        if (price > entry) wins++; else losses++
        pos = 0
      }
    }
  }
  if (pos > 0) { cash += pos * data[data.length - 1].close; if (data[data.length - 1].close > entry) wins++; else losses++ }
  const bh = (data[data.length - 1].close - data[200].close) / data[200].close * 100
  return { finalVal: cash, returnPct: (cash - capital) / capital * 100, trades, wins, losses, maxDD: maxDD * 100, buyHold: bh }
}

// V2 for comparison
function strategyV2(data, capital) {
  let cash = capital, pos = 0, entry = 0, highest = 0
  let trades = 0, wins = 0, losses = 0, peak = capital, maxDD = 0
  const closes = data.map(d => d.close)
  const ema10 = calcEMA(closes, 10); const ema10off = data.length - ema10.length
  const sma50 = calcSMA(data, 50); const sma50off = data.length - sma50.length
  const atrArr = calcATR(data, 14); const atrOff = data.length - atrArr.length - 1

  for (let i = 50; i < data.length; i++) {
    const price = data[i].close
    if (i > 0 && Math.abs((price - data[i - 1].close) / data[i - 1].close * 100) > 5) continue
    const equity = pos > 0 ? cash + pos * price : cash
    if (equity > peak) peak = equity; if ((peak - equity) / peak > maxDD) maxDD = (peak - equity) / peak
    const e10idx = i - ema10off; const s50idx = i - sma50off; const atrIdx = i - atrOff - 1
    if (e10idx < 2 || s50idx < 0 || atrIdx < 0) continue
    const e10 = ema10[e10idx]; const e10prev = ema10[e10idx - 1]; const s50 = sma50[s50idx]; const atr = atrArr[atrIdx]
    const rsi = calcRSI(data.slice(Math.max(0, i - 20), i + 1), 14)

    if (pos === 0 && price > s50 && e10 > e10prev && rsi > 40 && rsi < 65 && Math.abs(price - e10) / price < 0.02) {
      pos = Math.floor((cash * 0.95) / price)
      if (pos > 0) { entry = price; highest = price; cash -= pos * price; trades++ }
    }
    if (pos > 0) {
      if (price > highest) highest = price
      if (price <= highest - atr * 2.5 || price <= entry * 0.88 || (price < s50 && data[i - 1].close >= s50)) {
        cash += pos * price; if (price > entry) wins++; else losses++; pos = 0
      }
    }
  }
  if (pos > 0) { cash += pos * data[data.length - 1].close; if (data[data.length - 1].close > entry) wins++; else losses++ }
  const bh = (data[data.length - 1].close - data[50].close) / data[50].close * 100
  return { finalVal: cash, returnPct: (cash - capital) / capital * 100, trades, wins, losses, maxDD: maxDD * 100, buyHold: bh }
}

async function main() {
  const cap = 500

  // ═══ PART 1: LEVERAGED ETFs ═══
  console.log('')
  console.log('='.repeat(100))
  console.log('  TEIL 1: HEBEL-ETFs — SMA200 Strategie vs V2 Momentum (500 Euro, 5 Jahre)')
  console.log('='.repeat(100))
  console.log(pad('ETF', 8) + pad('V2 Algo', 10) + pad('V2 Wert', 10) + pad('SMA200', 10) + pad('SMA200 Wert', 12) + pad('B&H', 10) + pad('B&H Wert', 10) + pad('Trades', 7) + pad('W/L', 6) + 'Best')
  console.log('-'.repeat(100))

  for (const sym of LEVERAGED) {
    try {
      const data = await fetchData(sym)
      if (data.length < 300) continue
      const v2 = strategyV2(data, cap)
      const sma = strategySMA200(data, cap)
      const all = [
        { n: 'V2', r: v2.returnPct },
        { n: 'SMA200', r: sma.returnPct },
        { n: 'B&H', r: sma.buyHold },
      ]
      const best = all.reduce((a, b) => a.r > b.r ? a : b)
      console.log(
        pad(sym, 8) +
        pad(fmt(v2.returnPct), 10) + pad(v2.finalVal.toFixed(0) + 'E', 10) +
        pad(fmt(sma.returnPct), 10) + pad(sma.finalVal.toFixed(0) + 'E', 12) +
        pad(fmt(sma.buyHold), 10) + pad((cap + cap * sma.buyHold / 100).toFixed(0) + 'E', 10) +
        pad(sma.trades + '', 7) + pad(sma.wins + '/' + sma.losses, 6) +
        (best.n !== 'B&H' ? '>> ' : '   ') + best.n
      )
    } catch (e) { console.log(sym + ': ' + e.message) }
    await new Promise(r => setTimeout(r, 400))
  }

  // ═══ PART 2: INDIVIDUAL STOCKS ═══
  console.log('')
  console.log('='.repeat(100))
  console.log('  TEIL 2: EINZELAKTIEN — V4 (strenger) vs V2 (aktuell) (500 Euro, 5 Jahre)')
  console.log('  V4: 4/5 Konfirmationen, Trailing 3.5x ATR, Min 5 Tage halten, keine Teilverkaufe')
  console.log('='.repeat(100))
  console.log(pad('Aktie', 8) + pad('V2 Algo', 10) + pad('V2 W/L', 8) + pad('V4 Algo', 10) + pad('V4 W/L', 8) + pad('V4 Wert', 10) + pad('B&H', 10) + pad('V4>V2?', 8) + 'Best')
  console.log('-'.repeat(100))

  let v2sum = 0, v4sum = 0, bhsum = 0, cnt = 0, v4beats = 0

  for (const sym of STOCKS) {
    try {
      const data = await fetchData(sym)
      if (data.length < 300) continue
      const v2 = strategyV2(data, cap)
      const v4 = strategyV4(data, cap)
      v2sum += v2.returnPct; v4sum += v4.returnPct; bhsum += v4.buyHold; cnt++
      const v4better = v4.returnPct > v2.returnPct
      if (v4better) v4beats++
      const all = [
        { n: 'V2', r: v2.returnPct },
        { n: 'V4', r: v4.returnPct },
        { n: 'B&H', r: v4.buyHold },
      ]
      const best = all.reduce((a, b) => a.r > b.r ? a : b)
      console.log(
        pad(sym, 8) +
        pad(fmt(v2.returnPct), 10) + pad(v2.wins + '/' + v2.losses, 8) +
        pad(fmt(v4.returnPct), 10) + pad(v4.wins + '/' + v4.losses, 8) +
        pad(v4.finalVal.toFixed(0) + 'E', 10) + pad(fmt(v4.buyHold), 10) +
        pad(v4better ? 'JA' : 'nein', 8) +
        best.n
      )
    } catch (e) { console.log(sym + ': ' + e.message) }
    await new Promise(r => setTimeout(r, 400))
  }

  console.log('-'.repeat(100))
  console.log(pad('SCHNITT', 8) + pad(fmt(v2sum / cnt), 10) + pad('', 8) + pad(fmt(v4sum / cnt), 10) + pad('', 8) + pad('', 10) + pad(fmt(bhsum / cnt), 10) + 'V4>' + v4beats + '/' + cnt)

  console.log('')
  console.log('='.repeat(100))
  console.log('  EMPFEHLUNG')
  console.log('='.repeat(100))
  console.log('  Hebel-ETFs: SMA200 Strategie (wenige Trades, grosse Gewinne)')
  console.log('  Einzelaktien: V4 wenn Win-Rate besser, sonst V2 beibehalten')
  console.log('  Kombination: 60% Hebel-ETF (TQQQ) + 40% beste Einzelaktien')
  console.log('='.repeat(100))
}

function fmt(n) { return (n >= 0 ? '+' : '') + n.toFixed(0) + '%' }
function pad(s, n) { return (s + ' '.repeat(n)).slice(0, n) }
main().catch(console.error)
