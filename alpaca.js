// ============================================================
// ALPACA API CLIENT — Paper & Live Trading
// https://alpaca.markets/docs/api-references/trading-api/
// ============================================================

const PAPER_URL = 'https://paper-api.alpaca.markets'
const LIVE_URL = 'https://api.alpaca.markets'

function getConfig() {
  try {
    const { readFileSync, existsSync } = await import('fs')
    const { join, dirname } = await import('path')
    const { fileURLToPath } = await import('url')
  } catch {}

  // Config is stored in autotrader-data.json under config.alpaca
  return {
    apiKey: process.env.ALPACA_API_KEY || '',
    secretKey: process.env.ALPACA_SECRET_KEY || '',
    paper: process.env.ALPACA_PAPER !== 'false', // Default: paper trading
  }
}

export class AlpacaClient {
  constructor(apiKey, secretKey, paper = true) {
    this.apiKey = apiKey
    this.secretKey = secretKey
    this.baseUrl = paper ? PAPER_URL : LIVE_URL
    this.paper = paper
  }

  async request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`
    const headers = {
      'APCA-API-KEY-ID': this.apiKey,
      'APCA-API-SECRET-KEY': this.secretKey,
      'Content-Type': 'application/json',
    }

    const options = { method, headers }
    if (body) options.body = JSON.stringify(body)

    const res = await fetch(url, options)

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Alpaca ${method} ${path}: ${res.status} — ${err}`)
    }

    if (res.status === 204) return null
    return res.json()
  }

  // ── Account ──────────────────────────────────────────────
  async getAccount() {
    const acc = await this.request('GET', '/v2/account')
    return {
      id: acc.id,
      status: acc.status,
      cash: parseFloat(acc.cash),
      portfolioValue: parseFloat(acc.portfolio_value),
      buyingPower: parseFloat(acc.buying_power),
      equity: parseFloat(acc.equity),
      lastEquity: parseFloat(acc.last_equity),
      dayTradeCount: acc.daytrade_count,
      patternDayTrader: acc.pattern_day_trader,
      paper: this.paper,
    }
  }

  // ── Positions ────────────────────────────────────────────
  async getPositions() {
    const positions = await this.request('GET', '/v2/positions')
    return positions.map(p => ({
      symbol: p.symbol,
      quantity: parseFloat(p.qty),
      entryPrice: parseFloat(p.avg_entry_price),
      currentPrice: parseFloat(p.current_price),
      marketValue: parseFloat(p.market_value),
      unrealizedPnL: parseFloat(p.unrealized_pl),
      unrealizedPnLPercent: parseFloat(p.unrealized_plpc) * 100,
      side: p.side,
    }))
  }

  async getPosition(symbol) {
    try {
      const p = await this.request('GET', `/v2/positions/${symbol}`)
      return {
        symbol: p.symbol,
        quantity: parseFloat(p.qty),
        entryPrice: parseFloat(p.avg_entry_price),
        currentPrice: parseFloat(p.current_price),
        marketValue: parseFloat(p.market_value),
        unrealizedPnL: parseFloat(p.unrealized_pl),
        unrealizedPnLPercent: parseFloat(p.unrealized_plpc) * 100,
      }
    } catch {
      return null // No position
    }
  }

  // ── Orders ───────────────────────────────────────────────
  async placeOrder(symbol, quantity, side, type = 'market', timeInForce = 'day', limitPrice = null) {
    const order = {
      symbol,
      qty: quantity.toString(),
      side, // 'buy' or 'sell'
      type, // 'market', 'limit', 'stop', 'stop_limit'
      time_in_force: timeInForce, // 'day', 'gtc', 'ioc'
    }
    if (type === 'limit' && limitPrice) {
      order.limit_price = limitPrice.toString()
    }

    const result = await this.request('POST', '/v2/orders', order)
    return {
      id: result.id,
      symbol: result.symbol,
      quantity: parseFloat(result.qty),
      side: result.side,
      type: result.type,
      status: result.status,
      filledPrice: result.filled_avg_price ? parseFloat(result.filled_avg_price) : null,
      createdAt: result.created_at,
    }
  }

  async buyMarket(symbol, quantity) {
    console.log(`[ALPACA] ${this.paper ? 'PAPER' : 'LIVE'} BUY ${quantity}x ${symbol}`)
    return this.placeOrder(symbol, quantity, 'buy', 'market')
  }

  async sellMarket(symbol, quantity) {
    console.log(`[ALPACA] ${this.paper ? 'PAPER' : 'LIVE'} SELL ${quantity}x ${symbol}`)
    return this.placeOrder(symbol, quantity, 'sell', 'market')
  }

  async sellAll(symbol) {
    console.log(`[ALPACA] ${this.paper ? 'PAPER' : 'LIVE'} SELL ALL ${symbol}`)
    try {
      return await this.request('DELETE', `/v2/positions/${symbol}`)
    } catch (err) {
      console.error(`[ALPACA] Fehler beim Verkauf von ${symbol}:`, err.message)
      return null
    }
  }

  // ── Order History ────────────────────────────────────────
  async getOrders(status = 'all', limit = 50) {
    const orders = await this.request('GET', `/v2/orders?status=${status}&limit=${limit}`)
    return orders.map(o => ({
      id: o.id,
      symbol: o.symbol,
      quantity: parseFloat(o.qty),
      filledQuantity: parseFloat(o.filled_qty),
      side: o.side,
      type: o.type,
      status: o.status,
      filledPrice: o.filled_avg_price ? parseFloat(o.filled_avg_price) : null,
      createdAt: o.created_at,
      filledAt: o.filled_at,
    }))
  }

  async cancelOrder(orderId) {
    return this.request('DELETE', `/v2/orders/${orderId}`)
  }

  async cancelAllOrders() {
    return this.request('DELETE', '/v2/orders')
  }

  // ── Market Status ────────────────────────────────────────
  async isMarketOpen() {
    const clock = await this.request('GET', '/v2/clock')
    return {
      isOpen: clock.is_open,
      nextOpen: clock.next_open,
      nextClose: clock.next_close,
    }
  }
}

// ── Factory ────────────────────────────────────────────────
export function createAlpacaClient(apiKey, secretKey, paper = true) {
  if (!apiKey || !secretKey) return null
  return new AlpacaClient(apiKey, secretKey, paper)
}

// ── Test connection ────────────────────────────────────────
export async function testAlpacaConnection(apiKey, secretKey, paper = true) {
  try {
    const client = new AlpacaClient(apiKey, secretKey, paper)
    const account = await client.getAccount()
    return {
      success: true,
      account,
      message: `Verbunden! ${paper ? 'Paper' : 'Live'} Account: $${account.portfolioValue.toFixed(2)}`,
    }
  } catch (err) {
    return {
      success: false,
      account: null,
      message: `Verbindung fehlgeschlagen: ${err.message}`,
    }
  }
}
