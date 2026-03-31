// ============================================================
// AI ADVISOR — Claude als Trading-Berater
// Analysiert technische Signale + Marktkontext vor jedem Trade
// Gibt BUY/SELL/HOLD Empfehlung mit Begründung
// ============================================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

/**
 * Fragt Claude um eine zweite Meinung bevor der Bot tradet.
 * Gibt { approved: boolean, reason: string, adjustedConfidence: number } zurück.
 */
export async function getAIAdvice(tradeData) {
  if (!ANTHROPIC_API_KEY) {
    // No API key → skip AI, let bot decide alone
    return { approved: true, reason: 'KI-Berater nicht konfiguriert — Bot entscheidet allein', adjustedConfidence: tradeData.confidence }
  }

  const {
    symbol, price, signal, strategy, confidence,
    reasons, rsi, atr, portfolio, recentTrades,
    sectorStrength, earningsActive,
  } = tradeData

  const prompt = buildPrompt(tradeData)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[AI-ADVISOR] API Fehler: ${res.status} — ${err}`)
      return { approved: true, reason: 'KI-API nicht erreichbar — Bot entscheidet allein', adjustedConfidence: confidence }
    }

    const data = await res.json()
    const text = data.content?.[0]?.text || ''

    return parseAIResponse(text, confidence)
  } catch (err) {
    console.error(`[AI-ADVISOR] Fehler: ${err.message}`)
    return { approved: true, reason: 'KI-Fehler — Bot entscheidet allein', adjustedConfidence: confidence }
  }
}

function buildPrompt(data) {
  const {
    symbol, price, signal, strategy, confidence,
    reasons, rsi, atr, portfolio, recentTrades,
    sectorStrength, earningsActive, action,
  } = data

  const recentTradesStr = (recentTrades || [])
    .filter(t => t.symbol === symbol)
    .slice(0, 5)
    .map(t => `  ${t.date?.slice(0, 10)} ${t.type} ${t.quantity}x @ $${t.price?.toFixed(2)} | P&L: $${t.pnl?.toFixed(2) || 0}`)
    .join('\n') || '  Keine'

  const positionsStr = (portfolio?.positions || [])
    .map(p => `  ${p.symbol}: ${p.quantity}x @ $${p.entryPrice?.toFixed(2)} (aktuell $${p.currentPrice?.toFixed(2)})`)
    .join('\n') || '  Keine'

  return `Du bist ein erfahrener Trading-Berater. Analysiere diesen Trade und gib eine kurze Empfehlung.

TRADE-DETAILS:
- Aktion: ${action} (der Bot will ${action === 'BUY' ? 'kaufen' : 'verkaufen'})
- Symbol: ${symbol}
- Aktueller Kurs: $${price?.toFixed(2)}
- Strategie: ${strategy}
- Bot-Signal: ${signal} (Konfidenz: ${confidence}%)
- RSI: ${rsi?.toFixed(1) || '?'}
- ATR (Volatilität): $${atr?.toFixed(2) || '?'} (${((atr / price) * 100).toFixed(1)}% des Kurses)
- Earnings Season aktiv: ${earningsActive ? 'Ja' : 'Nein'}

SIGNAL-GRÜNDE DES BOTS:
${(reasons || []).join('\n')}

PORTFOLIO:
- Cash: €${portfolio?.cash?.toFixed(0) || '?'}
- Gesamtwert: €${portfolio?.totalValue?.toFixed(0) || '?'}
- Offene Positionen:
${positionsStr}

LETZTE TRADES FÜR ${symbol}:
${recentTradesStr}

Antworte NUR in diesem Format (3 Zeilen, nichts anderes):
DECISION: APPROVE oder REJECT
CONFIDENCE: [0-100]
REASON: [1 Satz auf Deutsch warum]`
}

function parseAIResponse(text, originalConfidence) {
  const lines = text.trim().split('\n')

  let approved = true
  let adjustedConfidence = originalConfidence
  let reason = 'KI-Analyse abgeschlossen'

  for (const line of lines) {
    const upper = line.toUpperCase().trim()
    if (upper.startsWith('DECISION:')) {
      approved = upper.includes('APPROVE')
    }
    if (upper.startsWith('CONFIDENCE:')) {
      const num = parseInt(line.replace(/\D/g, ''))
      if (num >= 0 && num <= 100) adjustedConfidence = num
    }
    if (upper.startsWith('REASON:')) {
      reason = line.replace(/^REASON:\s*/i, '').trim()
    }
  }

  return { approved, reason, adjustedConfidence }
}

/**
 * Analysiert vergangene Trades und gibt Verbesserungsvorschläge.
 * Wird einmal täglich aufgerufen.
 */
export async function analyzeTradeHistory(tradeLog, portfolio) {
  if (!ANTHROPIC_API_KEY) return null

  const recentTrades = (tradeLog || []).slice(0, 30)
  if (recentTrades.length < 5) return null // Zu wenig Daten

  const wins = recentTrades.filter(t => t.type === 'SELL' && t.pnl > 0)
  const losses = recentTrades.filter(t => t.type === 'SELL' && t.pnl < 0)
  const blocked = recentTrades.filter(t => t.type === 'BLOCKED')

  const tradesStr = recentTrades
    .filter(t => t.type === 'SELL')
    .map(t => `${t.date?.slice(0, 10)} ${t.symbol} ${t.type} | P&L: $${t.pnl?.toFixed(2)} (${t.pnlPercent?.toFixed(1)}%) | Haltezeit: ${t.holdDays}d | Grund: ${t.reason?.slice(0, 80)}`)
    .join('\n')

  const prompt = `Analysiere diese Trading-Historie und gib 3 konkrete Verbesserungsvorschläge.

STATISTIK:
- Gewinner: ${wins.length} Trades
- Verlierer: ${losses.length} Trades
- Blockiert (Spike-Schutz): ${blocked.length}
- Win-Rate: ${wins.length + losses.length > 0 ? ((wins.length / (wins.length + losses.length)) * 100).toFixed(0) : 0}%
- Gesamt P&L: $${recentTrades.filter(t => t.pnl).reduce((s, t) => s + (t.pnl || 0), 0).toFixed(2)}

LETZTE VERKÄUFE:
${tradesStr || 'Keine Verkäufe bisher'}

Antworte auf Deutsch, maximal 5 Sätze. Fokus auf: Timing, Position-Sizing, Stop-Loss Optimierung.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    return data.content?.[0]?.text || null
  } catch {
    return null
  }
}
