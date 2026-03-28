import { useMemo, useState } from 'react'
import { useMarketStore } from '@/store/useMarketStore'
import { generateSignals, getSignalColor, getSignalLabel } from '@/services/signals/signalEngine'
import { Card } from '@/components/ui/Card'
import { TrendingUp, TrendingDown, Minus, Activity, ChevronDown, ChevronUp, Info } from 'lucide-react'
import type { IndicatorSignal } from '@/types/indicators'

const indicatorExplanations: Record<string, { what: string; how: string; tip: string }> = {
  'RSI(14)': {
    what: 'Der Relative Stärke Index misst die Geschwindigkeit und Stärke von Kursbewegungen auf einer Skala von 0–100.',
    how: 'Unter 30 = überverkauft (Kaufgelegenheit). Über 70 = überkauft (Verkaufssignal). Zwischen 30–70 = neutral.',
    tip: 'Am stärksten in Seitwärtsmärkten. In starken Trends kann der RSI länger im Extrem bleiben.',
  },
  'MACD(12,26,9)': {
    what: 'Moving Average Convergence Divergence zeigt das Zusammen-/Auseinanderlaufen zweier EMAs und erkennt Trendwechsel.',
    how: 'Histogramm positiv = bullisch. Histogramm negativ = bärisch. Kreuzung der Nulllinie = starkes Signal.',
    tip: 'Besonders zuverlässig, wenn MACD-Kreuzung mit Volumenanstieg einhergeht.',
  },
  'SMA Trend': {
    what: 'Vergleicht den aktuellen Kurs mit dem 20- und 50-Tage Durchschnitt, um den kurz-/mittelfristigen Trend zu bestimmen.',
    how: 'Preis > SMA20 > SMA50 = starker Aufwärtstrend. Preis < SMA20 < SMA50 = starker Abwärtstrend.',
    tip: 'Goldenes Kreuz (SMA20 kreuzt SMA50 nach oben) ist eines der bekanntesten Kaufsignale.',
  },
  'SMA(200)': {
    what: 'Der 200-Tage Durchschnitt ist der wichtigste langfristige Trendindikator, den institutionelle Investoren nutzen.',
    how: 'Preis über SMA200 = langfristiger Bullenmarkt. Preis unter SMA200 = langfristiger Bärenmarkt.',
    tip: 'Der SMA200 dient oft als starke Unterstützung/Widerstand — Kurse prallen häufig davon ab.',
  },
  'Bollinger(20,2)': {
    what: 'Bollinger Bänder zeigen die Volatilität: ein oberes und unteres Band um den 20-Tage Durchschnitt.',
    how: 'Preis am unteren Band = potenziell überverkauft. Preis am oberen Band = potenziell überkauft.',
    tip: 'Wenn sich die Bänder verengen ("Squeeze"), steht oft eine große Bewegung bevor.',
  },
  'Stochastik(14,3)': {
    what: 'Vergleicht den Schlusskurs mit der Handelsspanne der letzten 14 Tage. Zeigt Wendepunkte.',
    how: '%K unter 20 = überverkauft (Kaufsignal wenn %K über %D kreuzt). Über 80 = überkauft.',
    tip: 'Am besten in Kombination mit Trendfiltern verwenden — in starken Trends oft Fehlsignale.',
  },
  'EMA Cross(12/26)': {
    what: 'Vergleicht den schnellen (12) mit dem langsamen (26) exponentiellen Durchschnitt.',
    how: 'EMA12 über EMA26 = bullisch. EMA12 unter EMA26 = bärisch. Kreuzung = Trendwechsel.',
    tip: 'Das "Goldene Kreuz" und "Todeskreuz" der EMAs sind klassische professionelle Signale.',
  },
}

export function SignalDashboard() {
  const ohlcv = useMarketStore((s) => s.ohlcv)
  const currentSymbol = useMarketStore((s) => s.currentSymbol)
  const [expanded, setExpanded] = useState<string | null>(null)

  const signal = useMemo(() => generateSignals(ohlcv), [ohlcv])

  const directionIcon = {
    STRONG_BUY: <TrendingUp className="text-green-500" size={24} />,
    BUY: <TrendingUp className="text-green-400" size={24} />,
    HOLD: <Minus className="text-yellow-500" size={24} />,
    SELL: <TrendingDown className="text-red-400" size={24} />,
    STRONG_SELL: <TrendingDown className="text-red-500" size={24} />,
  }

  function toggleExpand(name: string) {
    setExpanded(expanded === name ? null : name)
  }

  return (
    <div className="space-y-3">
      {/* Main Signal */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Signal für {currentSymbol}</div>
            <div className="mt-1 flex items-center gap-2">
              {directionIcon[signal.direction]}
              <span
                className="text-xl font-bold"
                style={{ color: getSignalColor(signal.direction) }}
              >
                {getSignalLabel(signal.direction)}
              </span>
            </div>
          </div>

          {/* Confidence Gauge */}
          <div className="text-center">
            <div className="relative h-16 w-16">
              <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" className="dark:stroke-gray-700" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={getSignalColor(signal.direction)}
                  strokeWidth="3"
                  strokeDasharray={`${signal.confidence} ${100 - signal.confidence}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold dark:text-white">{signal.confidence}%</span>
              </div>
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Konfidenz</div>
          </div>
        </div>
      </Card>

      {/* Individual Indicator Signals - clickable */}
      <Card title="Indikator-Analyse" action={
        <span className="text-xs text-gray-400">Klicke für Details</span>
      }>
        <div className="space-y-1.5">
          {signal.indicators.map((ind) => (
            <IndicatorRow
              key={ind.name}
              indicator={ind}
              isExpanded={expanded === ind.name}
              onToggle={() => toggleExpand(ind.name)}
            />
          ))}
        </div>
      </Card>
    </div>
  )
}

function IndicatorRow({
  indicator: ind,
  isExpanded,
  onToggle,
}: {
  indicator: IndicatorSignal
  isExpanded: boolean
  onToggle: () => void
}) {
  const explanation = indicatorExplanations[ind.name]
  const signalColor = ind.signal === 'BUY'
    ? 'border-l-green-500'
    : ind.signal === 'SELL'
      ? 'border-l-red-500'
      : 'border-l-gray-300 dark:border-l-gray-600'

  return (
    <div className={`rounded-lg border-l-3 bg-gray-50 transition-all dark:bg-[var(--color-bg-hover-dark)] ${signalColor}`}>
      {/* Main row - clickable */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-gray-400" />
          <span className="text-sm font-semibold dark:text-white">{ind.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              ind.signal === 'BUY'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : ind.signal === 'SELL'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {ind.signal === 'BUY' ? 'Kauf' : ind.signal === 'SELL' ? 'Verkauf' : 'Neutral'}
          </span>
          {isExpanded
            ? <ChevronUp size={14} className="text-gray-400" />
            : <ChevronDown size={14} className="text-gray-400" />
          }
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-gray-200 px-3 pb-3 pt-2 dark:border-gray-700">
          {/* Current value & reason */}
          <div className="mb-3 rounded-md bg-white px-3 py-2 dark:bg-[var(--color-bg-dark)]">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Aktueller Wert</div>
            <div className="mt-0.5 text-sm font-bold dark:text-white">{ind.value.toFixed(2)}</div>
            <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">{ind.reason}</div>
          </div>

          {/* Weight visualization */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Signalstärke:</span>
            <div className="flex gap-1">
              {[1, 2].map(i => (
                <div
                  key={i}
                  className={`h-2 w-6 rounded-full ${
                    i <= ind.weight
                      ? ind.signal === 'BUY' ? 'bg-green-500' : ind.signal === 'SELL' ? 'bg-red-500' : 'bg-gray-300'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-medium dark:text-gray-300">
              {ind.weight === 2 ? 'Stark' : ind.weight === 1 ? 'Moderat' : 'Schwach'}
            </span>
          </div>

          {/* Explanation */}
          {explanation && (
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Info size={12} className="mt-0.5 shrink-0 text-blue-500" />
                <div>
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">Was ist das?</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{explanation.what}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Activity size={12} className="mt-0.5 shrink-0 text-purple-500" />
                <div>
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">Wie liest man es?</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{explanation.how}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <TrendingUp size={12} className="mt-0.5 shrink-0 text-green-500" />
                <div>
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">Profi-Tipp</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{explanation.tip}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
