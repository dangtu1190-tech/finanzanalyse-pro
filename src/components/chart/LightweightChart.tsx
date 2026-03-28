import { useEffect, useRef } from 'react'
import {
  createChart,
  type IChartApi,
  ColorType,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
} from 'lightweight-charts'
import type { OHLCV, ChartType } from '@/types/market'
import type { IndicatorValue, BollingerValue } from '@/types/indicators'
import { useSettingsStore } from '@/store/useSettingsStore'

interface LightweightChartProps {
  data: OHLCV[]
  chartType: ChartType
  height?: number
  smaLines?: { data: IndicatorValue[]; color: string; label: string }[]
  bollingerBands?: BollingerValue[]
  volumeEnabled?: boolean
}

export function LightweightChart({
  data,
  chartType,
  height = 450,
  smaLines = [],
  bollingerBands,
  volumeEnabled = true,
}: LightweightChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const theme = useSettingsStore((s) => s.theme)

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return

    const isDark = theme === 'dark'
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? '#1a1d29' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#64748b',
        fontFamily: 'Inter, sans-serif',
      },
      grid: {
        vertLines: { color: isDark ? '#2a2d3a' : '#f1f5f9' },
        horzLines: { color: isDark ? '#2a2d3a' : '#f1f5f9' },
      },
      crosshair: {
        mode: 0,
        vertLine: { labelBackgroundColor: isDark ? '#3b82f6' : '#2563eb' },
        horzLine: { labelBackgroundColor: isDark ? '#3b82f6' : '#2563eb' },
      },
      rightPriceScale: {
        borderColor: isDark ? '#2a2d3a' : '#e2e8f0',
      },
      timeScale: {
        borderColor: isDark ? '#2a2d3a' : '#e2e8f0',
        timeVisible: true,
      },
    })
    chartRef.current = chart

    // Main series
    if (chartType === 'candlestick') {
      const mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      })
      mainSeries.setData(
        data.map((d) => ({
          time: d.time as any,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }))
      )
    } else if (chartType === 'area') {
      const mainSeries = chart.addSeries(AreaSeries, {
        lineColor: '#3b82f6',
        topColor: 'rgba(59, 130, 246, 0.4)',
        bottomColor: 'rgba(59, 130, 246, 0.0)',
        lineWidth: 2,
      })
      mainSeries.setData(
        data.map((d) => ({ time: d.time as any, value: d.close }))
      )
    } else {
      const mainSeries = chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 2,
      })
      mainSeries.setData(
        data.map((d) => ({ time: d.time as any, value: d.close }))
      )
    }

    // Volume
    if (volumeEnabled) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#3b82f680',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      })
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      })
      volumeSeries.setData(
        data.map((d) => ({
          time: d.time as any,
          value: d.volume,
          color: d.close >= d.open ? '#10b98140' : '#ef444440',
        }))
      )
    }

    // SMA / EMA overlay lines
    for (const line of smaLines) {
      const lineSeries = chart.addSeries(LineSeries, {
        color: line.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
      lineSeries.setData(
        line.data.map((d) => ({ time: d.time as any, value: d.value }))
      )
    }

    // Bollinger Bands
    if (bollingerBands && bollingerBands.length > 0) {
      const upperSeries = chart.addSeries(LineSeries, {
        color: '#8b5cf680',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
      const lowerSeries = chart.addSeries(LineSeries, {
        color: '#8b5cf680',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
      const middleSeries = chart.addSeries(LineSeries, {
        color: '#8b5cf6',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })

      upperSeries.setData(bollingerBands.map((d) => ({ time: d.time as any, value: d.upper })))
      lowerSeries.setData(bollingerBands.map((d) => ({ time: d.time as any, value: d.lower })))
      middleSeries.setData(bollingerBands.map((d) => ({ time: d.time as any, value: d.middle })))
    }

    chart.timeScale().fitContent()

    // Resize observer
    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [data, chartType, theme, height, smaLines, bollingerBands, volumeEnabled])

  return <div ref={containerRef} className="w-full" />
}
