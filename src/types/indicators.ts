export interface IndicatorValue {
  time: number
  value: number
}

export interface MACDValue {
  time: number
  macd: number
  signal: number
  histogram: number
}

export interface BollingerValue {
  time: number
  upper: number
  middle: number
  lower: number
}

export interface StochasticValue {
  time: number
  k: number
  d: number
}

export type IndicatorType = 'sma' | 'ema' | 'rsi' | 'macd' | 'bollinger' | 'stochastic' | 'atr' | 'obv'

export interface IndicatorConfig {
  type: IndicatorType
  enabled: boolean
  params: Record<string, number>
  color?: string
}

export interface SignalResult {
  direction: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL'
  confidence: number
  score: number
  indicators: IndicatorSignal[]
  timestamp: number
}

export interface IndicatorSignal {
  name: string
  value: number
  signal: 'BUY' | 'SELL' | 'NEUTRAL'
  reason: string
  weight: number
}
