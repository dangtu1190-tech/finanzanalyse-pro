import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatPercent } from '@/utils/formatters'
import {
  Bot, Play, Square, RotateCcw, TrendingUp, TrendingDown, DollarSign,
  BarChart3, Clock, Zap, Settings, AlertTriangle,
} from 'lucide-react'

interface AutoTraderData {
  config: {
    enabled: boolean
    checkIntervalMinutes: number
    initialCapital: number
    maxPositionPercent: number
    maxOpenPositions: number
    minConfidence: number
    sellConfidence: number
    stopLossPercent: number
    takeProfitPercent: number
    strategy: string
    watchlist: string[]
    allowedSignals: string[]
    sellSignals: string[]
  }
  portfolio: {
    cash: number
    positions: { symbol: string; quantity: number; entryPrice: number; entryDate: string; currentPrice: number }[]
    totalValue: number
  }
  tradeLog: {
    id: string; symbol: string; type: string; quantity: number; price: number
    date: string; reason: string; confidence: number; pnl: number; pnlPercent?: number; holdDays?: number
  }[]
  lastCheck: string | null
  stats: {
    totalTrades: number; winningTrades: number; losingTrades: number
    totalPnL: number; bestTrade: any; worstTrade: any; startDate: string
  }
}

export function AutoTraderPage() {
  const [data, setData] = useState<AutoTraderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/autotrader')
      const json = await res.json()
      setData(json)
    } catch { /* demo mode */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function toggleEnabled() {
    if (!data) return
    const res = await fetch('/api/autotrader/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !data.config.enabled }),
    })
    setData(await res.json())
  }

  async function runNow() {
    setRunning(true)
    try {
      const res = await fetch('/api/autotrader/run', { method: 'POST' })
      setData(await res.json())
    } catch { /* */ }
    setRunning(false)
  }

  async function resetTrader() {
    if (!confirm('Paper-Portfolio zurücksetzen? Alle Trades werden gelöscht.')) return
    const res = await fetch('/api/autotrader/reset', { method: 'POST' })
    setData(await res.json())
  }

  async function updateConfig(updates: Partial<AutoTraderData['config']>) {
    const res = await fetch('/api/autotrader/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setData(await res.json())
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>

  if (!data) return (
    <Card className="py-12 text-center">
      <Bot size={48} className="mx-auto mb-4 text-gray-400" />
      <div className="text-lg font-medium text-gray-500">Auto-Trader ist nur im deployen Modus verfügbar</div>
      <div className="mt-1 text-sm text-gray-400">Der Server muss auf Railway laufen</div>
    </Card>
  )

  const { config, portfolio, tradeLog, stats, lastCheck } = data
  const totalPnL = portfolio.totalValue - config.initialCapital
  const totalPnLPercent = (totalPnL / config.initialCapital) * 100
  const isPositive = totalPnL >= 0
  const winRate = stats.totalTrades > 0 ? (stats.winningTrades / stats.totalTrades) * 100 : 0

  const inputClass = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={24} className="text-blue-500" />
          <h1 className="text-2xl font-bold dark:text-white">Auto-Trader</h1>
          <span className={`ml-2 rounded-full px-3 py-1 text-xs font-bold ${
            config.enabled
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          }`}>
            {config.enabled ? 'AKTIV' : 'INAKTIV'}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={runNow} disabled={running}>
            <Zap size={14} className="mr-1" /> {running ? 'Prüfe...' : 'Jetzt prüfen'}
          </Button>
          <Button onClick={toggleEnabled} variant={config.enabled ? 'danger' : 'primary'}>
            {config.enabled ? <><Square size={14} className="mr-1" /> Stoppen</> : <><Play size={14} className="mr-1" /> Starten</>}
          </Button>
        </div>
      </div>

      {/* Paper Trading Banner */}
      <div className="flex items-center gap-2 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
        <AlertTriangle size={16} />
        <span><strong>Paper Trading</strong> — Kein echtes Geld. Simuliert mit ${config.initialCapital.toLocaleString('de-DE')} virtuellem Kapital.</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatBox icon={<DollarSign size={18} className="text-blue-500" />} label="Portfolio-Wert" value={formatCurrency(portfolio.totalValue)} />
        <StatBox icon={isPositive ? <TrendingUp size={18} className="text-green-500" /> : <TrendingDown size={18} className="text-red-500" />}
          label="Gesamt G&V" value={formatCurrency(totalPnL)} sub={formatPercent(totalPnLPercent)} positive={isPositive} />
        <StatBox icon={<BarChart3 size={18} className="text-purple-500" />} label="Trades" value={`${stats.totalTrades}`} sub={`${stats.winningTrades}W / ${stats.losingTrades}L`} />
        <StatBox icon={<Zap size={18} className="text-yellow-500" />} label="Trefferquote" value={`${winRate.toFixed(0)}%`} />
        <StatBox icon={<Clock size={18} className="text-gray-500" />} label="Letzter Check"
          value={lastCheck ? new Date(lastCheck).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—'}
          sub={lastCheck ? new Date(lastCheck).toLocaleDateString('de-DE') : ''} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_350px]">
        {/* Left: Positions & Trades */}
        <div className="space-y-4">
          {/* Open Positions */}
          <Card title={`Offene Positionen (${portfolio.positions.length})`}>
            {portfolio.positions.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Keine offenen Positionen — der Bot wartet auf Kaufsignale
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                      <th className="pb-2 text-left">Symbol</th>
                      <th className="pb-2 text-right">Anz.</th>
                      <th className="pb-2 text-right">Einstieg</th>
                      <th className="pb-2 text-right">Aktuell</th>
                      <th className="pb-2 text-right">G&V</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.positions.map(pos => {
                      const pnl = (pos.currentPrice - pos.entryPrice) * pos.quantity
                      const pnlPct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100
                      return (
                        <tr key={pos.symbol} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 font-semibold dark:text-white">{pos.symbol}</td>
                          <td className="py-2 text-right dark:text-gray-300">{pos.quantity}</td>
                          <td className="py-2 text-right dark:text-gray-300">{formatCurrency(pos.entryPrice)}</td>
                          <td className="py-2 text-right dark:text-gray-300">{formatCurrency(pos.currentPrice)}</td>
                          <td className={`py-2 text-right font-semibold ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {formatCurrency(pnl)} ({formatPercent(pnlPct)})
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 text-xs text-gray-400 text-right">
              Cash: {formatCurrency(portfolio.cash)}
            </div>
          </Card>

          {/* Trade Log */}
          <Card title={`Trade-Verlauf (${tradeLog.length})`}>
            {tradeLog.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Noch keine Trades ausgeführt
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {tradeLog.slice(0, 50).map(trade => (
                  <div key={trade.id} className={`rounded-lg border-l-3 px-3 py-2 ${
                    trade.type === 'BUY'
                      ? 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10'
                      : trade.pnl >= 0
                        ? 'border-l-green-500 bg-green-50 dark:bg-green-900/10'
                        : 'border-l-red-500 bg-red-50 dark:bg-red-900/10'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                          trade.type === 'BUY' ? 'bg-blue-200 text-blue-700' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>{trade.type === 'BUY' ? 'KAUF' : 'VERKAUF'}</span>
                        <span className="text-sm font-semibold dark:text-white">{trade.symbol}</span>
                        <span className="text-xs text-gray-500">{trade.quantity}x @ {formatCurrency(trade.price)}</span>
                      </div>
                      {trade.type === 'SELL' && (
                        <span className={`text-sm font-bold ${trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                          {trade.pnlPercent != null && ` (${formatPercent(trade.pnlPercent)})`}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(trade.date).toLocaleString('de-DE')} — {trade.reason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Config */}
        <div className="space-y-4">
          <Card title="Algorithmus-Einstellungen" action={
            <Settings size={14} className="text-gray-400" />
          }>
            <div className="space-y-3">
              {/* Strategy Selection */}
              <div>
                <label className="mb-1 block text-xs font-medium dark:text-gray-300">Strategie</label>
                <select value={config.strategy || 'auto'} onChange={e => updateConfig({ strategy: e.target.value })} className={inputClass}>
                  <option value="auto">Auto (SMA200 f. Hebel, V4 f. Aktien)</option>
                  <option value="sma200">SMA200 Hebel (wenige Trades, +108%/5J)</option>
                  <option value="v4_strict">V4 Streng (4/5 Konfirm., +65%/5J)</option>
                  <option value="momentum_v2">V2 Momentum (mehr Trades)</option>
                </select>
                <div className="mt-0.5 text-xs text-gray-400">Auto = beste Strategie je nach Symbol-Typ</div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium dark:text-gray-300">Prüfintervall (Minuten)</label>
                <input type="number" value={config.checkIntervalMinutes} onChange={e => updateConfig({ checkIntervalMinutes: parseInt(e.target.value) || 15 })} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium dark:text-gray-300">Min. Konfidenz zum Kaufen (%)</label>
                <input type="number" value={config.minConfidence} onChange={e => updateConfig({ minConfidence: parseInt(e.target.value) || 65 })} className={inputClass} />
                <div className="mt-0.5 text-xs text-gray-400">Nur kaufen wenn Signal-Konfidenz über diesem Wert</div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium dark:text-gray-300">Verkaufen unter Konfidenz (%)</label>
                <input type="number" value={config.sellConfidence} onChange={e => updateConfig({ sellConfidence: parseInt(e.target.value) || 40 })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium dark:text-gray-300">Stop-Loss (%)</label>
                  <input type="number" value={config.stopLossPercent} onChange={e => updateConfig({ stopLossPercent: parseFloat(e.target.value) || 8 })} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium dark:text-gray-300">Take-Profit (%)</label>
                  <input type="number" value={config.takeProfitPercent} onChange={e => updateConfig({ takeProfitPercent: parseFloat(e.target.value) || 15 })} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium dark:text-gray-300">Max. Positionen gleichzeitig</label>
                <input type="number" value={config.maxOpenPositions} onChange={e => updateConfig({ maxOpenPositions: parseInt(e.target.value) || 10 })} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium dark:text-gray-300">Max. pro Position (%)</label>
                <input type="number" value={config.maxPositionPercent} onChange={e => updateConfig({ maxPositionPercent: parseInt(e.target.value) || 20 })} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium dark:text-gray-300">Watchlist (kommagetrennt)</label>
                <input type="text" value={config.watchlist.join(', ')} onChange={e => updateConfig({ watchlist: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className={inputClass} />
                <div className="mt-0.5 text-xs text-gray-400">Symbole die der Bot überwacht</div>
              </div>
            </div>
          </Card>

          <Card title="Kauf-Regeln">
            <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                <span>Kaufe wenn Signal = <strong>{config.allowedSignals.join(' oder ')}</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                <span>UND Konfidenz &ge; <strong>{config.minConfidence}%</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                <span>Max. <strong>{config.maxPositionPercent}%</strong> des Kapitals pro Position</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                <span>Verkaufe bei Signal = <strong>{config.sellSignals?.join(' oder ') || 'SELL / STRONG_SELL'}</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                <span>Stop-Loss bei <strong>-{config.stopLossPercent}%</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                <span>Take-Profit bei <strong>+{config.takeProfitPercent}%</strong></span>
              </div>
            </div>
          </Card>

          {/* IBKR Broker */}
          <IBKRSettings config={config} onUpdate={updateConfig} />

          <Button variant="danger" size="sm" onClick={resetTrader} className="w-full">
            <RotateCcw size={14} className="mr-1" /> Portfolio zurücksetzen
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatBox({ icon, label, value, sub, positive }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; positive?: boolean
}) {
  return (
    <Card>
      <div className="flex items-center gap-2">{icon}<span className="text-xs text-gray-500 dark:text-gray-400">{label}</span></div>
      <div className={`mt-1 text-lg font-bold ${positive === true ? 'text-green-500' : positive === false ? 'text-red-500' : 'dark:text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
    </Card>
  )
}

function IBKRSettings({ config, onUpdate }: { config: any; onUpdate: (u: any) => void }) {
  const [gatewayUrl, setGatewayUrl] = useState(config.ibkr?.gatewayUrl || 'https://localhost:5000')
  const [accountId, setAccountId] = useState(config.ibkr?.accountId || '')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; accountId?: string } | null>(null)

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/ibkr/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gatewayUrl }),
      })
      const result = await res.json()
      setTestResult(result)
      if (result.success && result.accountId) {
        setAccountId(result.accountId)
      }
    } catch {
      setTestResult({ success: false, message: 'Gateway nicht erreichbar. Ist der Client Portal Gateway gestartet?' })
    }
    setTesting(false)
  }

  function handleSave() {
    onUpdate({ ibkr: { enabled: true, gatewayUrl, accountId } })
    setTestResult({ success: true, message: 'Gespeichert! IBKR ist jetzt aktiv.' })
  }

  function handleDisable() {
    onUpdate({ ibkr: { enabled: false, gatewayUrl: 'https://localhost:5000', accountId: '' } })
    setAccountId('')
    setTestResult(null)
  }

  const inputClass = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"

  return (
    <Card title="Broker: Interactive Brokers" action={
      config.ibkr?.enabled
        ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
            AKTIV
          </span>
        : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500 dark:bg-gray-800">AUS</span>
    }>
      <div className="space-y-3">
        <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
          IBKR handelt alle Aktien weltweit (US, DAX, Europa). SEPA-Einzahlung in EUR.
          Benötigt den <strong>Client Portal Gateway</strong> lokal.
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium dark:text-gray-300">Gateway URL</label>
          <input type="text" value={gatewayUrl} onChange={e => setGatewayUrl(e.target.value)} placeholder="https://localhost:5000" className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium dark:text-gray-300">Account ID</label>
          <input type="text" value={accountId} onChange={e => setAccountId(e.target.value)} placeholder="Wird automatisch ermittelt beim Test" className={inputClass} />
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleTest} disabled={testing} className="flex-1">
            {testing ? 'Teste...' : 'Verbindung testen'}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!accountId} className="flex-1">
            Speichern & Aktivieren
          </Button>
        </div>

        {config.ibkr?.enabled && (
          <button onClick={handleDisable} className="w-full text-xs text-red-500 hover:underline">
            IBKR deaktivieren
          </button>
        )}

        {testResult && (
          <div className={`rounded-lg px-3 py-2 text-xs ${
            testResult.success
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
          }`}>
            {testResult.message}
          </div>
        )}
      </div>
    </Card>
  )
}
