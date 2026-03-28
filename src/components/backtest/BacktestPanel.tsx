import { useState, useMemo } from 'react'
import { useMarketStore } from '@/store/useMarketStore'
import {
  runBacktest, getStrategyName, getStrategyDescription,
  type StrategyType, type BacktestConfig, type BacktestResult,
} from '@/services/backtest/backtestEngine'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatPercent } from '@/utils/formatters'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { FlaskConical, TrendingUp, TrendingDown, BarChart3, Target } from 'lucide-react'

const strategies: StrategyType[] = ['sma_cross', 'rsi_reversal', 'macd_cross', 'bollinger_bounce']

export function BacktestPanel() {
  const ohlcv = useMarketStore((s) => s.ohlcv)
  const currentSymbol = useMarketStore((s) => s.currentSymbol)

  const [strategy, setStrategy] = useState<StrategyType>('sma_cross')
  const [capital, setCapital] = useState('10000')
  const [posSize, setPosSize] = useState('80')
  const [stopLoss, setStopLoss] = useState('5')
  const [takeProfit, setTakeProfit] = useState('10')
  const [result, setResult] = useState<BacktestResult | null>(null)

  function handleRun() {
    if (ohlcv.length < 50) return

    const config: BacktestConfig = {
      strategy,
      initialCapital: parseFloat(capital),
      positionSizePercent: parseFloat(posSize),
      stopLossPercent: stopLoss ? parseFloat(stopLoss) : null,
      takeProfitPercent: takeProfit ? parseFloat(takeProfit) : null,
    }
    setResult(runBacktest(ohlcv, config))
  }

  const inputClass = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"

  return (
    <div className="space-y-4">
      {/* Config */}
      <Card title="Backtesting" action={
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <FlaskConical size={12} /> {currentSymbol}
        </div>
      }>
        <div className="space-y-3">
          {/* Strategy Selection */}
          <div className="grid grid-cols-2 gap-2">
            {strategies.map(s => (
              <button
                key={s}
                onClick={() => setStrategy(s)}
                className={`rounded-lg border p-2 text-left transition-colors ${
                  strategy === s
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                }`}
              >
                <div className="text-sm font-medium dark:text-white">{getStrategyName(s)}</div>
                <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{getStrategyDescription(s)}</div>
              </button>
            ))}
          </div>

          {/* Parameters */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium dark:text-gray-300">Startkapital ($)</label>
              <input type="number" value={capital} onChange={e => setCapital(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium dark:text-gray-300">Positionsgröße (%)</label>
              <input type="number" value={posSize} onChange={e => setPosSize(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium dark:text-gray-300">Stop-Loss (%)</label>
              <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)} placeholder="Leer = kein SL" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium dark:text-gray-300">Take-Profit (%)</label>
              <input type="number" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} placeholder="Leer = kein TP" className={inputClass} />
            </div>
          </div>

          <Button onClick={handleRun} className="w-full" disabled={ohlcv.length < 50}>
            <FlaskConical size={16} className="mr-2" /> Backtest starten
          </Button>
          {ohlcv.length < 50 && (
            <p className="text-xs text-gray-400 text-center">Mindestens 50 Datenpunkte erforderlich. Wähle einen größeren Zeitraum.</p>
          )}
        </div>
      </Card>

      {/* Results */}
      {result && <BacktestResults result={result} initialCapital={parseFloat(capital)} />}
    </div>
  )
}

function BacktestResults({ result, initialCapital }: { result: BacktestResult; initialCapital: number }) {
  const isPositive = result.totalReturn >= 0
  const beatsBuyHold = result.totalReturnPercent > result.buyHoldReturnPercent

  const equityData = useMemo(() => {
    // Sample every nth point to keep chart performant
    const step = Math.max(1, Math.floor(result.equityCurve.length / 200))
    return result.equityCurve
      .filter((_, i) => i % step === 0)
      .map(p => ({
        time: new Date(p.time * 1000).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
        value: Math.round(p.value),
      }))
  }, [result])

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <Card>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={isPositive ? <TrendingUp size={18} className="text-green-500" /> : <TrendingDown size={18} className="text-red-500" />}
            label="Gesamtrendite"
            value={formatCurrency(result.totalReturn)}
            sub={formatPercent(result.totalReturnPercent)}
            positive={isPositive}
          />
          <StatCard
            icon={<BarChart3 size={18} className="text-blue-500" />}
            label="Trades"
            value={`${result.totalTrades}`}
            sub={`${result.winningTrades}W / ${result.losingTrades}L`}
          />
          <StatCard
            icon={<Target size={18} className="text-purple-500" />}
            label="Trefferquote"
            value={`${result.winRate}%`}
            sub={`Profit-Faktor: ${result.profitFactor}`}
          />
          <StatCard
            icon={<TrendingDown size={18} className="text-red-500" />}
            label="Max. Drawdown"
            value={`-${result.maxDrawdown}%`}
            sub={`Sharpe: ${result.sharpeRatio}`}
          />
        </div>
      </Card>

      {/* Equity Curve */}
      <Card title="Equity-Kurve">
        <div className="h-56">
          <ResponsiveContainer>
            <LineChart data={equityData}>
              <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip
                formatter={(v: any) => formatCurrency(Number(v))}
                contentStyle={{ backgroundColor: '#1a1d29', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
              />
              <ReferenceLine y={initialCapital} stroke="#6b7280" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="value" stroke={isPositive ? '#10b981' : '#ef4444'} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* vs Buy & Hold */}
      <Card title="Vergleich: Strategie vs. Buy & Hold">
        <div className="grid grid-cols-2 gap-4">
          <div className={`rounded-lg p-3 text-center ${isPositive ? 'bg-green-50 dark:bg-green-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
            <div className="text-xs text-gray-500 dark:text-gray-400">Strategie</div>
            <div className={`text-xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercent(result.totalReturnPercent)}
            </div>
          </div>
          <div className={`rounded-lg p-3 text-center ${result.buyHoldReturnPercent >= 0 ? 'bg-green-50 dark:bg-green-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
            <div className="text-xs text-gray-500 dark:text-gray-400">Buy & Hold</div>
            <div className={`text-xl font-bold ${result.buyHoldReturnPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercent(result.buyHoldReturnPercent)}
            </div>
          </div>
        </div>
        <div className={`mt-2 rounded-lg py-1.5 text-center text-sm font-medium ${
          beatsBuyHold ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
        }`}>
          {beatsBuyHold ? 'Strategie schlägt Buy & Hold!' : 'Buy & Hold war besser'}
        </div>
      </Card>

      {/* Trade History */}
      <Card title={`Trade-Verlauf (${result.trades.length} Trades)`}>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="pb-1 text-left font-medium text-gray-500">Einstieg</th>
                <th className="pb-1 text-right font-medium text-gray-500">Einstiegspreis</th>
                <th className="pb-1 text-right font-medium text-gray-500">Ausstiegspreis</th>
                <th className="pb-1 text-right font-medium text-gray-500">G&V</th>
                <th className="pb-1 text-right font-medium text-gray-500">Grund</th>
              </tr>
            </thead>
            <tbody>
              {result.trades.map((t, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-1 dark:text-gray-300">
                    {new Date(t.entryTime * 1000).toLocaleDateString('de-DE')}
                  </td>
                  <td className="py-1 text-right dark:text-gray-300">{formatCurrency(t.entryPrice)}</td>
                  <td className="py-1 text-right dark:text-gray-300">{formatCurrency(t.exitPrice)}</td>
                  <td className={`py-1 text-right font-medium ${t.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatPercent(t.pnlPercent)}
                  </td>
                  <td className="py-1 text-right text-gray-500">{t.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function StatCard({ icon, label, value, sub, positive }: {
  icon: React.ReactNode; label: string; value: string; sub: string; positive?: boolean
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-[var(--color-bg-hover-dark)]">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className={`mt-1 text-lg font-bold ${
        positive === true ? 'text-green-500' : positive === false ? 'text-red-500' : 'dark:text-white'
      }`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{sub}</div>
    </div>
  )
}
