import { useMemo } from 'react'
import { useMarketStore } from '@/store/useMarketStore'
import { generateSignals, getSignalColor, getSignalLabel } from '@/services/signals/signalEngine'
import { generateAnalysisReport } from '@/services/analysis/analyst'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/utils/formatters'
import { Brain, Target, Shield, AlertTriangle, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react'

export function AnalystReport() {
  const ohlcv = useMarketStore((s) => s.ohlcv)
  const currentSymbol = useMarketStore((s) => s.currentSymbol)

  const report = useMemo(() => {
    const signal = generateSignals(ohlcv)
    return generateAnalysisReport(currentSymbol, ohlcv, signal)
  }, [ohlcv, currentSymbol])

  const signal = useMemo(() => generateSignals(ohlcv), [ohlcv])

  if (!report || ohlcv.length < 10) return null

  const isBuy = signal.direction === 'STRONG_BUY' || signal.direction === 'BUY'
  const isSell = signal.direction === 'STRONG_SELL' || signal.direction === 'SELL'

  return (
    <div className="space-y-4">
      {/* Main recommendation card */}
      <Card className="border-l-4" style={{ borderLeftColor: getSignalColor(signal.direction) }}>
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-900/20">
            <Brain size={24} className="text-blue-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold dark:text-white">KI-Analyse: {currentSymbol}</h3>
              <span
                className="rounded-full px-3 py-1 text-xs font-bold text-white"
                style={{ backgroundColor: getSignalColor(signal.direction) }}
              >
                {getSignalLabel(signal.direction)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300"
               dangerouslySetInnerHTML={{ __html: report.summary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
            />
          </div>
        </div>
      </Card>

      {/* Entry / Stop-Loss / Take-Profit */}
      {(report.entryPrice || report.stopLoss || report.takeProfit) && (
        <Card title="Handelsempfehlung">
          <div className="grid grid-cols-3 gap-4">
            {report.entryPrice && (
              <div className="rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-900/20">
                <Target size={18} className="mx-auto mb-1 text-blue-500" />
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {isBuy ? 'Einstieg' : 'Ausstieg'}
                </div>
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(report.entryPrice)}
                </div>
              </div>
            )}
            {report.stopLoss && (
              <div className="rounded-lg bg-red-50 p-3 text-center dark:bg-red-900/20">
                <Shield size={18} className="mx-auto mb-1 text-red-500" />
                <div className="text-xs text-gray-500 dark:text-gray-400">Stop-Loss</div>
                <div className="text-lg font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(report.stopLoss)}
                </div>
              </div>
            )}
            {report.takeProfit && (
              <div className="rounded-lg bg-green-50 p-3 text-center dark:bg-green-900/20">
                {isBuy
                  ? <TrendingUp size={18} className="mx-auto mb-1 text-green-500" />
                  : <TrendingDown size={18} className="mx-auto mb-1 text-green-500" />
                }
                <div className="text-xs text-gray-500 dark:text-gray-400">Kursziel</div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(report.takeProfit)}
                </div>
              </div>
            )}
          </div>
          {report.riskRewardRatio && (
            <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-gray-50 py-2 dark:bg-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">Chance/Risiko:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {report.riskRewardRatio.toFixed(1)} : 1
              </span>
            </div>
          )}
          {report.positionSizing && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
              {report.positionSizing}
            </div>
          )}
        </Card>
      )}

      {/* Warnings */}
      {report.warnings.length > 0 && (
        <Card>
          <div className="space-y-2">
            {report.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-yellow-50 px-3 py-2 dark:bg-yellow-900/10">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow-500" />
                <span className="text-sm text-yellow-800 dark:text-yellow-300">{w}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Detail Sections */}
      {report.detailSections.map((section, i) => (
        <Card key={i} title={section.title}>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{section.text}</p>
        </Card>
      ))}

      {/* Key Levels */}
      <Card title="Wichtige Kursmarken">
        <div className="space-y-1">
          {report.keyLevels
            .sort((a, b) => b.price - a.price)
            .map((level, i) => {
              const isCurrentPrice = level.label === 'Aktueller Preis'
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded px-3 py-1.5 text-sm ${
                    isCurrentPrice
                      ? 'bg-blue-50 font-semibold dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isCurrentPrice ? <ArrowRight size={14} className="text-blue-500" />
                      : <Minus size={14} className="text-gray-300" />}
                    <span className="dark:text-gray-300">{level.label}</span>
                  </div>
                  <span className={isCurrentPrice ? 'text-blue-600 dark:text-blue-400' : 'dark:text-white'}>
                    {formatCurrency(level.price)}
                  </span>
                </div>
              )
            })}
        </div>
      </Card>
    </div>
  )
}
