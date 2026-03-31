const STOCKS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA', 'META', 'AMD', 'NFLX', 'COIN', 'CRM', 'PLTR', 'SAP.DE', 'VOW3.DE', 'BAYN.DE', 'SPY', 'QQQ'];

async function fetchData(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5y`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) return [];
  const ts = result.timestamp || [];
  const q = result.indicators?.quote?.[0];
  if (!q) return [];
  const ohlcv = [];
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null) continue;
    ohlcv.push({ time: ts[i], open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume?.[i] || 0 });
  }
  return ohlcv;
}

function calcSMA(data, period) {
  const r = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    r.push(sum / period);
  }
  return r;
}

function calcEMA(closes, period) {
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = [ema];
  for (let i = period; i < closes.length; i++) { ema = closes[i] * k + ema * (1 - k); result.push(ema); }
  return result;
}

function calcRSI(data, period) {
  if (data.length < period + 1) return [];
  const result = [];
  let ag = 0, al = 0;
  for (let i = 1; i <= period; i++) { const c = data[i].close - data[i - 1].close; if (c >= 0) ag += c; else al -= c; }
  ag /= period; al /= period;
  result.push({ idx: period, val: al === 0 ? 100 : 100 - 100 / (1 + ag / al) });
  for (let i = period + 1; i < data.length; i++) {
    const c = data[i].close - data[i - 1].close;
    ag = (ag * (period - 1) + (c >= 0 ? c : 0)) / period;
    al = (al * (period - 1) + (c < 0 ? -c : 0)) / period;
    result.push({ idx: i, val: al === 0 ? 100 : 100 - 100 / (1 + ag / al) });
  }
  return result;
}

function calcATR(data, period) {
  const trs = [];
  for (let i = 1; i < data.length; i++) {
    trs.push(Math.max(data[i].high - data[i].low, Math.abs(data[i].high - data[i - 1].close), Math.abs(data[i].low - data[i - 1].close)));
  }
  if (trs.length < period) return [];
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = [atr];
  for (let i = period; i < trs.length; i++) { atr = (atr * (period - 1) + trs[i]) / period; result.push(atr); }
  return result;
}

// V1: Current (SMA Cross, fixed SL/TP)
function strategyV1(data, capital) {
  let cash = capital, pos = 0, entry = 0, trades = 0, wins = 0, losses = 0, peak = capital, maxDD = 0;
  for (let i = 50; i < data.length; i++) {
    const slice = data.slice(0, i + 1);
    const sma20 = calcSMA(slice, 20); const sma50 = calcSMA(slice, 50);
    const s20 = sma20[sma20.length - 1]; const s50 = sma50[sma50.length - 1];
    const price = data[i].close;
    if (i > 0 && Math.abs((price - data[i - 1].close) / data[i - 1].close * 100) > 4) continue;
    const equity = pos > 0 ? cash + pos * price : cash;
    if (equity > peak) peak = equity; if ((peak - equity) / peak > maxDD) maxDD = (peak - equity) / peak;
    if (pos === 0 && s20 > s50 && sma20.length >= 2 && sma50.length >= 2 && sma20[sma20.length - 2] <= sma50[sma50.length - 2]) {
      pos = Math.floor((cash * 0.9) / price); if (pos > 0) { entry = price; cash -= pos * price; trades++; }
    }
    if (pos > 0 && sma20.length >= 2 && sma50.length >= 2) {
      const pnlPct = (price - entry) / entry * 100;
      if ((sma20[sma20.length - 2] >= sma50[sma50.length - 2] && s20 < s50) || pnlPct <= -8 || pnlPct >= 15) {
        cash += pos * price; if (price > entry) wins++; else losses++; pos = 0;
      }
    }
  }
  if (pos > 0) { cash += pos * data[data.length - 1].close; if (data[data.length - 1].close > entry) wins++; else losses++; }
  return { finalVal: cash, returnPct: (cash - capital) / capital * 100, trades, wins, losses, maxDD: maxDD * 100 };
}

// V2: Momentum + Trailing Stop (ATR-based)
function strategyV2(data, capital) {
  let cash = capital, pos = 0, entry = 0, highest = 0, trades = 0, wins = 0, losses = 0, peak = capital, maxDD = 0;
  const closes = data.map(d => d.close);
  const ema10 = calcEMA(closes, 10); const ema10off = data.length - ema10.length;
  const sma50arr = calcSMA(data, 50); const sma50off = data.length - sma50arr.length;
  const rsiArr = calcRSI(data, 14);
  const atrArr = calcATR(data, 14); const atrOff = data.length - atrArr.length - 1;

  for (let i = 50; i < data.length; i++) {
    const price = data[i].close;
    if (i > 0 && Math.abs((price - data[i - 1].close) / data[i - 1].close * 100) > 5) continue;
    const equity = pos > 0 ? cash + pos * price : cash;
    if (equity > peak) peak = equity; if ((peak - equity) / peak > maxDD) maxDD = (peak - equity) / peak;
    const e10idx = i - ema10off; const s50idx = i - sma50off; const atrIdx = i - atrOff - 1;
    if (e10idx < 2 || s50idx < 0 || atrIdx < 0) continue;
    const e10 = ema10[e10idx]; const e10prev = ema10[e10idx - 1]; const s50 = sma50arr[s50idx]; const atr = atrArr[atrIdx];
    const rsiE = rsiArr.find(r => r.idx === i); const rsi = rsiE ? rsiE.val : 50;

    if (pos === 0) {
      const aboveTrend = price > s50; const emaRising = e10 > e10prev;
      const rsiGood = rsi > 40 && rsi < 65;
      const nearEma = Math.abs(price - e10) / price < 0.02;
      if (aboveTrend && emaRising && rsiGood && nearEma) {
        pos = Math.floor((cash * 0.95) / price);
        if (pos > 0) { entry = price; highest = price; cash -= pos * price; trades++; }
      }
    }
    if (pos > 0) {
      if (price > highest) highest = price;
      const trailStop = highest - atr * 2.5; const hardStop = entry * 0.88;
      const trendBreak = price < s50 && data[i - 1].close >= s50;
      if (price <= trailStop || price <= hardStop || trendBreak) {
        cash += pos * price; if (price > entry) wins++; else losses++; pos = 0;
      } else if (rsi > 80 && (price - entry) / entry > 0.20) {
        const sellQty = Math.floor(pos / 2);
        if (sellQty > 0) { cash += sellQty * price; pos -= sellQty; if (price > entry) wins++; }
      }
    }
  }
  if (pos > 0) { cash += pos * data[data.length - 1].close; if (data[data.length - 1].close > entry) wins++; else losses++; }
  return { finalVal: cash, returnPct: (cash - capital) / capital * 100, trades, wins, losses, maxDD: maxDD * 100 };
}

// V3: RSI Dip-Buyer in uptrend + wide trailing stop
function strategyV3(data, capital) {
  let cash = capital, pos = 0, entry = 0, highest = 0, trades = 0, wins = 0, losses = 0, peak = capital, maxDD = 0;
  const sma50arr = calcSMA(data, 50); const s50off = data.length - sma50arr.length;
  const sma200arr = calcSMA(data, 200); const s200off = data.length - sma200arr.length;
  const rsiArr = calcRSI(data, 14);
  const atrArr = calcATR(data, 14); const atrOff = data.length - atrArr.length - 1;

  for (let i = 200; i < data.length; i++) {
    const price = data[i].close;
    if (i > 0 && Math.abs((price - data[i - 1].close) / data[i - 1].close * 100) > 5) continue;
    const equity = pos > 0 ? cash + pos * price : cash;
    if (equity > peak) peak = equity; if ((peak - equity) / peak > maxDD) maxDD = (peak - equity) / peak;
    const s50 = sma50arr[i - s50off] || price; const s200 = sma200arr[i - s200off] || price;
    const atrIdx = i - atrOff - 1; const atr = atrIdx >= 0 ? atrArr[atrIdx] : price * 0.02;
    const rsiE = rsiArr.find(r => r.idx === i); const rsiP = rsiArr.find(r => r.idx === i - 1);
    const rsi = rsiE ? rsiE.val : 50; const rsiPrev = rsiP ? rsiP.val : 50;

    if (pos === 0) {
      const inUptrend = price > s200;
      const rsiDip = rsiPrev < 35 && rsi >= 35;
      const notCrashing = price > s50 * 0.92;
      if (inUptrend && rsiDip && notCrashing) {
        pos = Math.floor((cash * 0.95) / price);
        if (pos > 0) { entry = price; highest = price; cash -= pos * price; trades++; }
      }
    }
    if (pos > 0) {
      if (price > highest) highest = price;
      if (price <= highest - atr * 3 || price <= entry * 0.85 || price < s200) {
        cash += pos * price; if (price > entry) wins++; else losses++; pos = 0;
      }
    }
  }
  if (pos > 0) { cash += pos * data[data.length - 1].close; if (data[data.length - 1].close > entry) wins++; else losses++; }
  return { finalVal: cash, returnPct: (cash - capital) / capital * 100, trades, wins, losses, maxDD: maxDD * 100 };
}

async function main() {
  const cap = 500;
  console.log('');
  console.log('='.repeat(100));
  console.log('  3 STRATEGIEN IM VERGLEICH - 500 Euro Startkapital, 5 Jahre, echte Yahoo Daten');
  console.log('='.repeat(100));
  console.log('  V1 = AKTUELL  (SMA Cross, Stop-Loss -8%, Take-Profit +15%)');
  console.log('  V2 = MOMENTUM (EMA10 + Trend + Trailing Stop basierend auf ATR)');
  console.log('  V3 = DIP-BUY  (RSI Dips im Aufwaertstrend + weiter Trailing Stop)');
  console.log('='.repeat(100));
  console.log('');
  console.log(pad('Aktie', 10) + pad('B&H', 9) + ' | ' + pad('V1 Alt', 9) + pad('W/L', 6) + ' | ' + pad('V2 Mom', 9) + pad('W/L', 6) + ' | ' + pad('V3 Dip', 9) + pad('W/L', 6) + ' | Best');
  console.log('-'.repeat(100));

  let v1Total = 0, v2Total = 0, v3Total = 0, bhTotal = 0, count = 0;
  let v2Wins = 0, v3Wins = 0, bhWins = 0;

  for (const symbol of STOCKS) {
    try {
      const data = await fetchData(symbol);
      if (data.length < 250) continue;
      const bh = ((data[data.length - 1].close - data[50].close) / data[50].close * 100);
      const r1 = strategyV1(data, cap);
      const r2 = strategyV2(data, cap);
      const r3 = strategyV3(data, cap);

      const all = [{ name: 'B&H', ret: bh }, { name: 'V1', ret: r1.returnPct }, { name: 'V2', ret: r2.returnPct }, { name: 'V3', ret: r3.returnPct }];
      const best = all.reduce((a, b) => a.ret > b.ret ? a : b);
      if (best.name === 'V2') v2Wins++;
      else if (best.name === 'V3') v3Wins++;
      else if (best.name === 'B&H') bhWins++;

      console.log(
        pad(symbol, 10) + pad(fmt(bh), 9) + ' | ' +
        pad(fmt(r1.returnPct), 9) + pad(r1.wins + '/' + r1.losses, 6) + ' | ' +
        pad(fmt(r2.returnPct), 9) + pad(r2.wins + '/' + r2.losses, 6) + ' | ' +
        pad(fmt(r3.returnPct), 9) + pad(r3.wins + '/' + r3.losses, 6) + ' | ' +
        (best.name === 'V2' || best.name === 'V3' ? '>> ' : '   ') + best.name
      );

      v1Total += r1.returnPct; v2Total += r2.returnPct; v3Total += r3.returnPct; bhTotal += bh; count++;
    } catch (e) { console.log(symbol + ': Error'); }
    await new Promise(r => setTimeout(r, 400));
  }

  console.log('-'.repeat(100));
  console.log(pad('SCHNITT', 10) + pad(fmt(bhTotal / count), 9) + ' | ' + pad(fmt(v1Total / count), 9) + pad('', 6) + ' | ' + pad(fmt(v2Total / count), 9) + pad('', 6) + ' | ' + pad(fmt(v3Total / count), 9));
  console.log('');
  const v1Avg = v1Total / count, v2Avg = v2Total / count, v3Avg = v3Total / count, bhAvg = bhTotal / count;
  console.log('  500 Euro nach 5 Jahren (Durchschnitt):');
  console.log('    B&H:     ' + (cap + cap * bhAvg / 100).toFixed(0) + ' Euro (' + fmt(bhAvg) + ')');
  console.log('    V1 Alt:  ' + (cap + cap * v1Avg / 100).toFixed(0) + ' Euro (' + fmt(v1Avg) + ')');
  console.log('    V2 Mom:  ' + (cap + cap * v2Avg / 100).toFixed(0) + ' Euro (' + fmt(v2Avg) + ')');
  console.log('    V3 Dip:  ' + (cap + cap * v3Avg / 100).toFixed(0) + ' Euro (' + fmt(v3Avg) + ')');
  console.log('');
  console.log('  Algo gewinnt gegen B&H: V2 bei ' + v2Wins + '/' + count + ', V3 bei ' + v3Wins + '/' + count);
  console.log('='.repeat(100));
}

function fmt(n) { return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'; }
function pad(s, n) { return (s + ' '.repeat(n)).slice(0, n); }
main().catch(console.error);
