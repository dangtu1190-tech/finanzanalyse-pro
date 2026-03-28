export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  const squaredDiffs = values.map(v => (v - avg) ** 2)
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1))
}

export function downsideDeviation(values: number[], target = 0): number {
  const downside = values.filter(v => v < target).map(v => (v - target) ** 2)
  if (downside.length === 0) return 0
  return Math.sqrt(downside.reduce((a, b) => a + b, 0) / values.length)
}

export function maxDrawdown(values: number[]): number {
  let peak = -Infinity
  let maxDd = 0
  for (const val of values) {
    if (val > peak) peak = val
    const dd = (peak - val) / peak
    if (dd > maxDd) maxDd = dd
  }
  return maxDd
}

export function returns(prices: number[]): number[] {
  const r: number[] = []
  for (let i = 1; i < prices.length; i++) {
    r.push((prices[i] - prices[i - 1]) / prices[i - 1])
  }
  return r
}

export function covariance(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  const meanA = mean(a.slice(0, len))
  const meanB = mean(b.slice(0, len))
  let sum = 0
  for (let i = 0; i < len; i++) {
    sum += (a[i] - meanA) * (b[i] - meanB)
  }
  return sum / (len - 1)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
