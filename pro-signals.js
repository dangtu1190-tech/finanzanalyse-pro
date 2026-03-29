// ============================================================
// PRO SIGNALS — Professional-grade market intelligence
// Earnings, Sector Rotation, Unusual Volume, Correlations
// ============================================================

// ── 1. EARNINGS CALENDAR ────────────────────────────────────
// Rule: Don't buy 3 days before earnings (too risky)
// Rule: Buy the dip after earnings if RSI < 40 and trend intact

const EARNINGS_SEASONS = {
  // Q1 earnings: mid-April to mid-May
  // Q2 earnings: mid-July to mid-August
  // Q3 earnings: mid-October to mid-November
  // Q4 earnings: mid-January to mid-February
  q1: { start: [4, 10], end: [5, 15] },
  q2: { start: [7, 10], end: [8, 15] },
  q3: { start: [10, 10], end: [11, 15] },
  q4: { start: [1, 10], end: [2, 15] },
}

export function isEarningsSeason() {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()

  for (const [, season] of Object.entries(EARNINGS_SEASONS)) {
    const [sm, sd] = season.start
    const [em, ed] = season.end
    if ((month === sm && day >= sd) || (month === em && day <= ed) ||
        (month > sm && month < em)) {
      return true
    }
  }
  return false
}

export function getEarningsWarning() {
  if (isEarningsSeason()) {
    return {
      active: true,
      message: 'Earnings Season aktiv — erhöhte Volatilität möglich. Positionen kleiner halten.',
      reducePositionBy: 0.3, // Reduce position size by 30%
    }
  }
  return { active: false, message: '', reducePositionBy: 0 }
}


// ── 2. SECTOR ROTATION ──────────────────────────────────────
// Track which sectors are gaining/losing momentum
// Buy stocks in strengthening sectors, avoid weakening ones

const SECTOR_MAP = {
  // Technology
  'AAPL': 'tech', 'MSFT': 'tech', 'NVDA': 'tech', 'GOOGL': 'tech',
  'META': 'tech', 'AMD': 'tech', 'CRM': 'tech', 'NFLX': 'tech',
  'SAP.DE': 'tech', 'IFX.DE': 'tech', 'ASML.AS': 'tech',
  // Consumer
  'AMZN': 'consumer', 'TSLA': 'consumer', 'ADS.DE': 'consumer',
  'BMW.DE': 'auto', 'VOW3.DE': 'auto', 'MBG.DE': 'auto',
  // Finance
  'COIN': 'finance', 'ALV.DE': 'finance', 'JPM': 'finance',
  // Healthcare
  'BAYN.DE': 'health', 'NOVO-B.CO': 'health',
  // Telecom
  'DTE.DE': 'telecom',
  // Luxury
  'MC.PA': 'luxury',
  // Food
  'NESN.SW': 'food',
  // Growth
  'PLTR': 'growth', 'SOFI': 'growth', 'MSTR': 'growth',
  // Index
  'SPY': 'index', 'QQQ': 'index', 'VOO': 'index', 'VTI': 'index',
  'DIA': 'index', 'IWM': 'index', 'EUNL.DE': 'index', 'EXS1.DE': 'index',
}

export async function analyzeSectorStrength(fetchFn) {
  // Fetch sector ETFs to determine rotation
  const sectorETFs = {
    tech: 'XLK', health: 'XLV', finance: 'XLF',
    consumer: 'XLY', energy: 'XLE', industrial: 'XLI',
  }

  const results = {}

  for (const [sector, etf] of Object.entries(sectorETFs)) {
    try {
      const data = await fetchFn(etf, '3mo', '1d')
      if (data.length < 20) continue

      const recent5 = data.slice(-5)
      const recent20 = data.slice(-20)
      const change5d = (recent5[recent5.length - 1].close - recent5[0].close) / recent5[0].close * 100
      const change20d = (recent20[recent20.length - 1].close - recent20[0].close) / recent20[0].close * 100

      // Momentum score: recent performance relative to longer term
      const momentum = change5d - (change20d / 4) // 5d vs weekly rate of 20d

      results[sector] = {
        etf,
        change5d: Math.round(change5d * 100) / 100,
        change20d: Math.round(change20d * 100) / 100,
        momentum: Math.round(momentum * 100) / 100,
        strength: momentum > 1 ? 'STRONG' : momentum > 0 ? 'MODERATE' : momentum > -1 ? 'WEAK' : 'AVOID',
      }
    } catch { /* skip */ }
  }

  return results
}

export function getSectorSignal(symbol, sectorStrength) {
  const sector = SECTOR_MAP[symbol]
  if (!sector || !sectorStrength[sector]) {
    return { boost: 0, reason: '' }
  }

  const strength = sectorStrength[sector]

  if (strength.strength === 'STRONG') {
    return {
      boost: 1,
      reason: `Sektor ${sector.toUpperCase()} stark (5T: +${strength.change5d}%) → Rückenwind`,
    }
  } else if (strength.strength === 'AVOID') {
    return {
      boost: -2,
      reason: `Sektor ${sector.toUpperCase()} schwach (5T: ${strength.change5d}%) → Gegenwind`,
    }
  } else if (strength.strength === 'WEAK') {
    return {
      boost: -1,
      reason: `Sektor ${sector.toUpperCase()} nachlassend`,
    }
  }

  return { boost: 0, reason: '' }
}


// ── 3. UNUSUAL VOLUME DETECTION ─────────────────────────────
// Institutional buying/selling leaves volume footprints
// If volume is 2x+ average with price up → institutions buying
// If volume is 2x+ average with price down → institutions selling

export function detectInstitutionalActivity(ohlcv) {
  if (ohlcv.length < 30) return { detected: false }

  const latest = ohlcv[ohlcv.length - 1]
  const prev = ohlcv[ohlcv.length - 2]

  // Average volume (last 20 days, excluding today)
  const volumes = ohlcv.slice(-21, -1).map(d => d.volume)
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length
  if (avgVolume === 0) return { detected: false }

  const volumeRatio = latest.volume / avgVolume
  const priceChange = (latest.close - prev.close) / prev.close * 100

  // Check multiple days of elevated volume (accumulation/distribution)
  const last5Volumes = ohlcv.slice(-5).map(d => d.volume)
  const avgLast5 = last5Volumes.reduce((a, b) => a + b, 0) / last5Volumes.length
  const sustainedHighVolume = avgLast5 > avgVolume * 1.5

  // Institutional accumulation: price up on high volume over multiple days
  if (sustainedHighVolume && priceChange > 0) {
    const last5Changes = []
    for (let i = ohlcv.length - 5; i < ohlcv.length; i++) {
      last5Changes.push(ohlcv[i].close > ohlcv[i - 1].close ? 1 : -1)
    }
    const upDays = last5Changes.filter(c => c > 0).length

    if (upDays >= 3) {
      return {
        detected: true,
        type: 'ACCUMULATION',
        boost: 2,
        reason: `Institutionelle Akkumulation: ${upDays}/5 Tage aufwärts mit ${(avgLast5 / avgVolume).toFixed(1)}x Volumen`,
        volumeRatio,
      }
    }
  }

  // Institutional distribution: price down on high volume
  if (sustainedHighVolume && priceChange < 0) {
    const last5Changes = []
    for (let i = ohlcv.length - 5; i < ohlcv.length; i++) {
      last5Changes.push(ohlcv[i].close > ohlcv[i - 1].close ? 1 : -1)
    }
    const downDays = last5Changes.filter(c => c < 0).length

    if (downDays >= 3) {
      return {
        detected: true,
        type: 'DISTRIBUTION',
        boost: -2,
        reason: `Institutionelle Distribution: ${downDays}/5 Tage abwärts mit ${(avgLast5 / avgVolume).toFixed(1)}x Volumen`,
        volumeRatio,
      }
    }
  }

  // Single day unusual volume spike
  if (volumeRatio > 3) {
    return {
      detected: true,
      type: priceChange > 0 ? 'UNUSUAL_BUY' : 'UNUSUAL_SELL',
      boost: priceChange > 0 ? 1 : -1,
      reason: `Ungewöhnliches Volumen: ${volumeRatio.toFixed(1)}x Durchschnitt (${priceChange > 0 ? 'Kaufdruck' : 'Verkaufsdruck'})`,
      volumeRatio,
    }
  }

  return { detected: false, boost: 0 }
}


// ── 4. CORRELATION-BASED SIGNALS ────────────────────────────
// When SPY drops but a stock holds → relative strength → bullish
// When SPY rises but a stock drops → relative weakness → bearish

export function analyzeRelativeStrength(stockOhlcv, benchmarkOhlcv) {
  if (stockOhlcv.length < 20 || benchmarkOhlcv.length < 20) {
    return { signal: 0, reason: '' }
  }

  // Compare last 5 days performance
  const stockReturn5d = (stockOhlcv[stockOhlcv.length - 1].close - stockOhlcv[stockOhlcv.length - 6].close) /
    stockOhlcv[stockOhlcv.length - 6].close * 100
  const benchReturn5d = (benchmarkOhlcv[benchmarkOhlcv.length - 1].close - benchmarkOhlcv[benchmarkOhlcv.length - 6].close) /
    benchmarkOhlcv[benchmarkOhlcv.length - 6].close * 100

  const relativeStrength = stockReturn5d - benchReturn5d

  // Also check 20-day relative strength
  const stockReturn20d = (stockOhlcv[stockOhlcv.length - 1].close - stockOhlcv[stockOhlcv.length - 21].close) /
    stockOhlcv[stockOhlcv.length - 21].close * 100
  const benchReturn20d = (benchmarkOhlcv[benchmarkOhlcv.length - 1].close - benchmarkOhlcv[benchmarkOhlcv.length - 21].close) /
    benchmarkOhlcv[benchmarkOhlcv.length - 21].close * 100

  const relativeStrength20d = stockReturn20d - benchReturn20d

  // Strong relative strength on both timeframes
  if (relativeStrength > 2 && relativeStrength20d > 3) {
    return {
      signal: 2,
      reason: `Relative Stärke vs SPY: 5T +${relativeStrength.toFixed(1)}%, 20T +${relativeStrength20d.toFixed(1)}% → Outperformer`,
    }
  }

  if (relativeStrength > 1) {
    return {
      signal: 1,
      reason: `Leichte relative Stärke vs SPY (+${relativeStrength.toFixed(1)}%)`,
    }
  }

  // Stock drops while market is flat/up → weak
  if (relativeStrength < -2 && relativeStrength20d < -3) {
    return {
      signal: -2,
      reason: `Relative Schwäche vs SPY: 5T ${relativeStrength.toFixed(1)}%, 20T ${relativeStrength20d.toFixed(1)}% → Underperformer`,
    }
  }

  if (relativeStrength < -1) {
    return {
      signal: -1,
      reason: `Leichte relative Schwäche vs SPY (${relativeStrength.toFixed(1)}%)`,
    }
  }

  return { signal: 0, reason: '' }
}


// ── 5. MULTI-TIMEFRAME CONFIRMATION ─────────────────────────
// Weekly trend must confirm daily signal
// Prevents buying against the larger trend

export function checkWeeklyTrend(dailyData) {
  if (dailyData.length < 100) return { confirmed: true, reason: '' }

  // Simulate weekly bars from daily
  const weeklyCloses = []
  for (let i = 0; i < dailyData.length; i += 5) {
    const week = dailyData.slice(i, Math.min(i + 5, dailyData.length))
    weeklyCloses.push(week[week.length - 1].close)
  }

  if (weeklyCloses.length < 10) return { confirmed: true, reason: '' }

  // Weekly SMA10 (= ~50 daily)
  const sma10w = weeklyCloses.slice(-10).reduce((a, b) => a + b, 0) / 10
  const currentPrice = weeklyCloses[weeklyCloses.length - 1]

  // Weekly trend direction
  const sma10w_prev = weeklyCloses.slice(-11, -1).reduce((a, b) => a + b, 0) / 10

  if (currentPrice > sma10w && sma10w > sma10w_prev) {
    return {
      confirmed: true,
      direction: 'UP',
      reason: 'Wochentrend aufwärts → bestätigt Kaufsignal',
      boost: 1,
    }
  }

  if (currentPrice < sma10w && sma10w < sma10w_prev) {
    return {
      confirmed: false,
      direction: 'DOWN',
      reason: 'Wochentrend abwärts → Kaufsignal NICHT bestätigt',
      boost: -2,
    }
  }

  return { confirmed: true, direction: 'SIDEWAYS', reason: 'Wochentrend seitwärts', boost: 0 }
}


// ── 6. SMART POSITION SIZING ────────────────────────────────
// Volatility-adjusted: higher volatility = smaller position
// Kelly Criterion simplified

export function calculateSmartPositionSize(capital, price, atr, confidence, earningsWarning) {
  // Base: risk 2% of capital per trade
  const riskPercent = 2
  const riskAmount = capital * (riskPercent / 100)

  // Stop distance based on ATR
  const stopDistance = atr * 2.5
  if (stopDistance <= 0) return { quantity: 0, reason: 'ATR zu niedrig' }

  // Shares based on risk
  let quantity = Math.floor(riskAmount / stopDistance)

  // Adjust for confidence
  if (confidence >= 75) quantity = Math.floor(quantity * 1.3)  // High confidence → larger
  else if (confidence < 55) quantity = Math.floor(quantity * 0.5) // Low confidence → smaller

  // Reduce during earnings season
  if (earningsWarning.active) {
    quantity = Math.floor(quantity * (1 - earningsWarning.reducePositionBy))
  }

  // Cap at max position size (no more than 25% of capital)
  const maxShares = Math.floor((capital * 0.25) / price)
  quantity = Math.min(quantity, maxShares)

  // Minimum 1 share
  quantity = Math.max(quantity, price <= capital ? 1 : 0)

  const investAmount = quantity * price
  const investPercent = (investAmount / capital) * 100

  return {
    quantity,
    investAmount: Math.round(investAmount * 100) / 100,
    investPercent: Math.round(investPercent * 10) / 10,
    stopDistance: Math.round(stopDistance * 100) / 100,
    riskAmount: Math.round(Math.min(quantity * stopDistance, riskAmount) * 100) / 100,
    reason: `${quantity} Anteile (${investPercent.toFixed(1)}% des Kapitals, Risiko: $${(quantity * stopDistance).toFixed(2)})`,
  }
}
