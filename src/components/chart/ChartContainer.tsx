import { useMemo } from 'react'
import { useMarketStore } from '@/store/useMarketStore'
import { LightweightChart } from './LightweightChart'
import { ChartToolbar } from './ChartToolbar'
import { IndicatorPanel } from './IndicatorPanel'
import { calcSMA, calcEMA, calcRSI, calcMACD, calcBollingerBands, calcStochastic, calcATR } from '@/services/indicators'
import { INDICATOR_PRESETS } from '@/config/constants'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

export function ChartContainer() {
  const { ohlcv, chartType, activeIndicators, loading } = useMarketStore()

  const overlayLines = useMemo(() => {
    const lines: { data: { time: number; value: number }[]; color: string; label: string }[] = []

    if (activeIndicators.includes('sma')) {
      const { periods, colors } = INDICATOR_PRESETS.sma
      periods.forEach((p, i) => {
        const sma = calcSMA(ohlcv, p)
        if (sma.length > 0) lines.push({ data: sma, color: colors[i], label: `SMA(${p})` })
      })
    }

    if (activeIndicators.includes('ema')) {
      const { periods, colors } = INDICATOR_PRESETS.ema
      periods.forEach((p, i) => {
        const ema = calcEMA(ohlcv, p)
        if (ema.length > 0) lines.push({ data: ema, color: colors[i], label: `EMA(${p})` })
      })
    }

    return lines
  }, [ohlcv, activeIndicators])

  const bollingerBands = useMemo(() => {
    if (!activeIndicators.includes('bollinger') || ohlcv.length < 20) return undefined
    return calcBollingerBands(ohlcv, INDICATOR_PRESETS.bollinger.period, INDICATOR_PRESETS.bollinger.stdDev)
  }, [ohlcv, activeIndicators])

  const rsiData = useMemo(() => {
    if (!activeIndicators.includes('rsi') || ohlcv.length < 15) return undefined
    return calcRSI(ohlcv, INDICATOR_PRESETS.rsi.period)
  }, [ohlcv, activeIndicators])

  const macdData = useMemo(() => {
    if (!activeIndicators.includes('macd') || ohlcv.length < 35) return undefined
    return calcMACD(ohlcv, INDICATOR_PRESETS.macd.fast, INDICATOR_PRESETS.macd.slow, INDICATOR_PRESETS.macd.signal)
  }, [ohlcv, activeIndicators])

  const stochasticData = useMemo(() => {
    if (!activeIndicators.includes('stochastic') || ohlcv.length < 17) return undefined
    return calcStochastic(ohlcv, INDICATOR_PRESETS.stochastic.kPeriod, INDICATOR_PRESETS.stochastic.dPeriod)
  }, [ohlcv, activeIndicators])

  const atrData = useMemo(() => {
    if (!activeIndicators.includes('atr') || ohlcv.length < 15) return undefined
    return calcATR(ohlcv, INDICATOR_PRESETS.atr.period)
  }, [ohlcv, activeIndicators])

  if (loading && ohlcv.length === 0) {
    return (
      <Card className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      <Card>
        <ChartToolbar />
      </Card>

      <Card className="p-0 overflow-hidden">
        <LightweightChart
          data={ohlcv}
          chartType={chartType}
          smaLines={overlayLines}
          bollingerBands={bollingerBands}
          height={450}
        />
      </Card>

      {/* Sub-panels for oscillators */}
      {rsiData && <IndicatorPanel type="rsi" rsiData={rsiData} />}
      {macdData && <IndicatorPanel type="macd" macdData={macdData} />}
      {stochasticData && <IndicatorPanel type="stochastic" stochasticData={stochasticData} />}
      {atrData && <IndicatorPanel type="atr" atrData={atrData} />}
    </div>
  )
}
