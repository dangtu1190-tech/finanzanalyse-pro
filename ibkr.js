// ============================================================
// INTERACTIVE BROKERS (IBKR) API CLIENT
// Uses IBKR Client Portal API (REST-based, no TWS needed)
// https://www.interactivebrokers.com/api/doc.html
// ============================================================

// IBKR Client Portal Gateway runs locally or on your server
// Default: https://localhost:5000 (self-signed cert)
// For production: use IBKR's Client Portal Gateway Docker image

const DEFAULT_GATEWAY = 'https://localhost:5000'

export class IBKRClient {
  constructor(gatewayUrl = DEFAULT_GATEWAY) {
    this.baseUrl = gatewayUrl
    this.authenticated = false
  }

  async request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      // IBKR uses self-signed certs locally
    }
    if (body) options.body = JSON.stringify(body)

    const res = await fetch(url, options)
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`IBKR ${method} ${path}: ${res.status} — ${err}`)
    }
    if (res.status === 204) return null
    return res.json()
  }

  // ── Authentication ───────────────────────────────────────
  async checkAuth() {
    try {
      const status = await this.request('GET', '/v1/api/iserver/auth/status')
      this.authenticated = status.authenticated === true
      return {
        authenticated: this.authenticated,
        connected: status.connected === true,
        competing: status.competing === true,
        message: status.message || '',
      }
    } catch (err) {
      return { authenticated: false, connected: false, message: err.message }
    }
  }

  async reauthenticate() {
    return this.request('POST', '/v1/api/iserver/reauthenticate')
  }

  async keepAlive() {
    return this.request('POST', '/v1/api/tickle')
  }

  // ── Account ──────────────────────────────────────────────
  async getAccounts() {
    const data = await this.request('GET', '/v1/api/iserver/accounts')
    return data.accounts || []
  }

  async getAccountSummary(accountId) {
    const data = await this.request('GET', `/v1/api/portfolio/${accountId}/summary`)
    return {
      accountId,
      netLiquidation: data.netliquidation?.amount || 0,
      totalCash: data.totalcashvalue?.amount || 0,
      unrealizedPnL: data.unrealizedpnl?.amount || 0,
      realizedPnL: data.realizedpnl?.amount || 0,
      buyingPower: data.buyingpower?.amount || 0,
      currency: data.netliquidation?.currency || 'USD',
    }
  }

  // ── Positions ────────────────────────────────────────────
  async getPositions(accountId) {
    const data = await this.request('GET', `/v1/api/portfolio/${accountId}/positions/0`)
    if (!Array.isArray(data)) return []

    return data.map(p => ({
      symbol: p.ticker || p.contractDesc || '',
      conid: p.conid,
      quantity: p.position || 0,
      entryPrice: p.avgCost || 0,
      currentPrice: p.mktPrice || 0,
      marketValue: p.mktValue || 0,
      unrealizedPnL: p.unrealizedPnl || 0,
      currency: p.currency || 'USD',
      assetClass: p.assetClass || '',
    }))
  }

  // ── Search / Contract Lookup ─────────────────────────────
  async searchSymbol(symbol) {
    const data = await this.request('GET', `/v1/api/iserver/secdef/search?symbol=${encodeURIComponent(symbol)}`)
    if (!Array.isArray(data)) return []
    return data.map(s => ({
      conid: s.conid,
      symbol: s.symbol,
      name: s.companyName || s.description || '',
      exchange: s.exchange || '',
      type: s.secType || '',
    }))
  }

  async getConid(symbol) {
    const results = await this.searchSymbol(symbol)
    if (results.length === 0) throw new Error(`Symbol ${symbol} nicht gefunden`)
    return results[0].conid
  }

  // ── Orders ───────────────────────────────────────────────
  async placeOrder(accountId, conid, side, quantity, orderType = 'MKT', price = null) {
    const order = {
      conid,
      orderType,     // 'MKT', 'LMT', 'STP', 'STP_LIMIT'
      side,          // 'BUY' or 'SELL'
      quantity,
      tif: 'DAY',    // Time in force: 'DAY', 'GTC', 'IOC'
    }
    if (orderType === 'LMT' && price) {
      order.price = price
    }

    const body = { orders: [order] }
    const result = await this.request('POST', `/v1/api/iserver/account/${accountId}/orders`, body)

    // IBKR may return a confirmation request
    if (result && result[0] && result[0].id) {
      // Need to confirm
      const confirmResult = await this.request('POST', `/v1/api/iserver/reply/${result[0].id}`, { confirmed: true })
      return confirmResult
    }

    return result
  }

  async buyMarket(accountId, symbol, quantity) {
    console.log(`[IBKR] BUY ${quantity}x ${symbol}`)
    const conid = await this.getConid(symbol)
    return this.placeOrder(accountId, conid, 'BUY', quantity, 'MKT')
  }

  async sellMarket(accountId, symbol, quantity) {
    console.log(`[IBKR] SELL ${quantity}x ${symbol}`)
    const conid = await this.getConid(symbol)
    return this.placeOrder(accountId, conid, 'SELL', quantity, 'MKT')
  }

  async sellAll(accountId, symbol) {
    const positions = await this.getPositions(accountId)
    const pos = positions.find(p => p.symbol === symbol || p.symbol.startsWith(symbol))
    if (!pos || pos.quantity <= 0) {
      console.log(`[IBKR] Keine Position in ${symbol}`)
      return null
    }
    return this.sellMarket(accountId, symbol, pos.quantity)
  }

  // ── Order History ────────────────────────────────────────
  async getOrders() {
    const data = await this.request('GET', '/v1/api/iserver/account/orders')
    const orders = data.orders || []
    return orders.map(o => ({
      orderId: o.orderId,
      symbol: o.ticker || '',
      conid: o.conid,
      side: o.side,
      quantity: o.totalSize || 0,
      filledQuantity: o.filledQuantity || 0,
      price: o.price || 0,
      avgPrice: o.avgPrice || 0,
      status: o.status || '',
      orderType: o.orderType || '',
      timeInForce: o.timeInForce || '',
    }))
  }

  // ── Market Status ────────────────────────────────────────
  async getMarketStatus() {
    try {
      const data = await this.request('GET', '/v1/api/iserver/marketdata/snapshot?conids=756733&fields=31') // SPY
      return { open: true }
    } catch {
      return { open: false }
    }
  }
}

// ── Factory ────────────────────────────────────────────────
export function createIBKRClient(gatewayUrl) {
  return new IBKRClient(gatewayUrl || DEFAULT_GATEWAY)
}

// ── Connection Test ────────────────────────────────────────
export async function testIBKRConnection(gatewayUrl) {
  try {
    const client = new IBKRClient(gatewayUrl || DEFAULT_GATEWAY)
    const auth = await client.checkAuth()

    if (!auth.authenticated) {
      return {
        success: false,
        message: `Gateway erreichbar, aber nicht eingeloggt. Öffne ${gatewayUrl || DEFAULT_GATEWAY} im Browser und logge dich ein.`,
        auth,
      }
    }

    const accounts = await client.getAccounts()
    const accountId = accounts[0]
    let summary = null
    if (accountId) {
      summary = await client.getAccountSummary(accountId)
    }

    return {
      success: true,
      message: `Verbunden! Account: ${accountId} | Wert: $${summary?.netLiquidation?.toFixed(2) || '?'}`,
      auth,
      accountId,
      summary,
    }
  } catch (err) {
    return {
      success: false,
      message: `Gateway nicht erreichbar: ${err.message}. Starte den IBKR Client Portal Gateway.`,
      auth: null,
    }
  }
}
