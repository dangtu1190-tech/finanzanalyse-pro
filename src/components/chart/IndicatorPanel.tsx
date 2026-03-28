import { useEffect, useRef } from 'react'
import {
  createChart,
  ColorType,
  LineSeries,
  HistogramSeries,
} from 'lightweight-charts'
import type { IndicatorValue, MACDValue, StochasticValue } from '@/types/indicators'
import { useSettingsStore } from '@/store/useSettingsStore'

interface IndicatorPanelProps {
  type: 'rsi' | 'macd' | 'stochastic' | 'atr'
  rsiData?: IndicatorValue[]
  macdData?: MACDValue[]
  stochasticData?: StochasticValue[]
  atrData?: IndicatorValue[]
  height?: number
}

export function IndicatorPanel({ type, rsiData, macdData, stochasticData, atrData, height = 150 }: IndicatorPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const theme = useSettingsStore((s) => s.theme)

  useEffect(() => {
    if (!containerRef.current) return

    const isDark = theme === 'dark'
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? '#1a1d29' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#64748b',
        fontFamily: 'Inter, sans-serif',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: isDark ? '#2a2d3a' : '#f1f5f9' },
        horzLines: { color: isDark ? '#2a2d3a' : '#f1f5f9' },
      },
      rightPriceScale: { borderColor: isDark ? '#2a2d3a' : '#e2e8f0' },
      timeScale: { borderColor: isDark ? '#2a2d3a' : '#e2e8f0', visible: false },
      crosshair: { mode: 0 },
    })

    if (type === 'rsi' && rsiData && rsiData.length > 0) {
      const series = chart.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 2,
        priceLineVisible: false,
      })
      series.setData(rsiData.map((d) => ({ time: d.time as any, value: d.value })))
      series.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '70' })
      series.createPriceLine({ price: 30, color: '#10b981', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '30' })
    }

    if (type === 'macd' && macdData && macdData.length > 0) {
      const macdLine = chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      macdLine.setData(macdData.map((d) => ({ time: d.time as any, value: d.macd })))

      const signalLine = chart.addSeries(LineSeries, {
        color: '#ef4444',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      signalLine.setData(macdData.map((d) => ({ time: d.time as any, value: d.signal })))

      const histogram = chart.addSeries(HistogramSeries, {
        priceLineVisible: false,
        lastValueVisible: false,
      })
      histogram.setData(
        macdData.map((d) => ({
          time: d.time as any,
          value: d.histogram,
          color: d.histogram >= 0 ? '#10b98180' : '#ef444480',
        }))
      )
    }

    if (type === 'stochastic' && stochasticData && stochasticData.length > 0) {
      const kLine = chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 2,
        priceLineVisible: false,
      })
      kLine.setData(stochasticData.map((d) => ({ time: d.time as any, value: d.k })))

      const dLine = chart.addSeries(LineSeries, {
        color: '#ef4444',
        lineWidth: 1,
        priceLineVisible: false,
      })
      dLine.setData(stochasticData.map((d) => ({ time: d.time as any, value: d.d })))

      kLine.createPriceLine({ price: 80, color: '#ef4444', lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' })
      kLine.createPriceLine({ price: 20, color: '#10b981', lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' })
    }

    if (type === 'atr' && atrData && atrData.length > 0) {
      const series = chart.addSeries(LineSeries, {
        color: '#8b5cf6',
        lineWidth: 2,
        priceLineVisible: false,
      })
      series.setData(atrData.map((d) => ({ time: d.time as any, value: d.value })))
    }

    chart.timeScale().fitContent()

    const observer = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      chart.remove()
    }
  }, [type, rsiData, macdData, stochasticData, atrData, theme, height])

  const labels: Record<string, string> = {
    rsi: 'RSI (14)',
    macd: 'MACD (12, 26, 9)',
    stochastic: 'Stochastik (14, 3)',
    atr: 'ATR (14)',
  }

  return (
    <div className="mt-1">
      <div className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">{labels[type]}</div>
      <div ref={containerRef} className="w-full rounded-lg border border-gray-200 dark:border-[var(--color-border-dark)]" />
    </div>
  )
}
