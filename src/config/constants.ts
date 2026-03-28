export const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query'
export const CORS_PROXY = 'https://corsproxy.io/?url='

export const DEFAULT_SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA']

export const SECTOR_ETFS: Record<string, string> = {
  'Technologie': 'XLK',
  'Gesundheit': 'XLV',
  'Finanzen': 'XLF',
  'Energie': 'XLE',
  'Konsum': 'XLY',
  'Industrie': 'XLI',
  'Materialien': 'XLB',
  'Immobilien': 'XLRE',
  'Versorger': 'XLU',
  'Kommunikation': 'XLC',
  'Basiskonsumgüter': 'XLP',
}

export const TIMEFRAMES = [
  { label: '1T', value: '1D', days: 1 },
  { label: '1W', value: '1W', days: 7 },
  { label: '1M', value: '1M', days: 30 },
  { label: '3M', value: '3M', days: 90 },
  { label: '6M', value: '6M', days: 180 },
  { label: '1J', value: '1Y', days: 365 },
  { label: '5J', value: '5Y', days: 1825 },
] as const

export const CHART_TYPES = [
  { label: 'Kerzen', value: 'candlestick' },
  { label: 'Linie', value: 'line' },
  { label: 'Fläche', value: 'area' },
  { label: 'Balken', value: 'bar' },
] as const

export const INDICATOR_PRESETS = {
  sma: { name: 'SMA', periods: [20, 50, 200], colors: ['#f59e0b', '#3b82f6', '#ef4444'] },
  ema: { name: 'EMA', periods: [12, 26, 50], colors: ['#8b5cf6', '#ec4899', '#14b8a6'] },
  rsi: { name: 'RSI', period: 14, overbought: 70, oversold: 30 },
  macd: { name: 'MACD', fast: 12, slow: 26, signal: 9 },
  bollinger: { name: 'Bollinger Bänder', period: 20, stdDev: 2 },
  stochastic: { name: 'Stochastik', kPeriod: 14, dPeriod: 3, smoothing: 3 },
  atr: { name: 'ATR', period: 14 },
}

// DAX 40 Unternehmen (Yahoo Finance Symbole)
export const DAX_SYMBOLS: Record<string, string> = {
  'SAP.DE': 'SAP SE',
  'SIE.DE': 'Siemens AG',
  'ALV.DE': 'Allianz SE',
  'DTE.DE': 'Deutsche Telekom',
  'AIR.DE': 'Airbus SE',
  'MBG.DE': 'Mercedes-Benz',
  'BMW.DE': 'BMW AG',
  'VOW3.DE': 'Volkswagen AG',
  'BAS.DE': 'BASF SE',
  'MUV2.DE': 'Münchener Rück',
  'DHL.DE': 'DHL Group',
  'IFX.DE': 'Infineon Technologies',
  'ADS.DE': 'adidas AG',
  'BEI.DE': 'Beiersdorf AG',
  'DB1.DE': 'Deutsche Börse',
  'DBK.DE': 'Deutsche Bank',
  'RWE.DE': 'RWE AG',
  'HEN3.DE': 'Henkel AG',
  'BAYN.DE': 'Bayer AG',
  'P911.DE': 'Porsche AG',
  'PAH3.DE': 'Porsche SE',
  'FRE.DE': 'Fresenius SE',
  'HEI.DE': 'Heidelberg Materials',
  'MTX.DE': 'MTU Aero Engines',
  'SHL.DE': 'Siemens Healthineers',
  'ENR.DE': 'Siemens Energy',
  'CON.DE': 'Continental AG',
  'DTG.DE': 'Daimler Truck',
  'VNA.DE': 'Vonovia SE',
  'MRK.DE': 'Merck KGaA',
}

// Beliebte Märkte für Schnellzugriff (Klick auf leeres Suchfeld)
export const POPULAR_MARKETS = {
  'DAX': [
    { symbol: 'SAP.DE', name: 'SAP' },
    { symbol: 'SIE.DE', name: 'Siemens' },
    { symbol: 'ALV.DE', name: 'Allianz' },
    { symbol: 'VOW3.DE', name: 'VW' },
    { symbol: 'BMW.DE', name: 'BMW' },
    { symbol: 'MBG.DE', name: 'Mercedes' },
    { symbol: 'DTE.DE', name: 'Dt. Telekom' },
    { symbol: 'BAYN.DE', name: 'Bayer' },
    { symbol: 'ADS.DE', name: 'adidas' },
    { symbol: 'IFX.DE', name: 'Infineon' },
  ],
  'US Top': [
    { symbol: 'AAPL', name: 'Apple' },
    { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'NVDA', name: 'NVIDIA' },
    { symbol: 'GOOGL', name: 'Alphabet' },
    { symbol: 'AMZN', name: 'Amazon' },
    { symbol: 'TSLA', name: 'Tesla' },
    { symbol: 'META', name: 'Meta' },
    { symbol: 'JPM', name: 'JPMorgan' },
  ],
  'Indizes & ETFs': [
    { symbol: 'SPY', name: 'S&P 500' },
    { symbol: 'QQQ', name: 'NASDAQ 100' },
    { symbol: 'DIA', name: 'Dow Jones' },
    { symbol: 'EXS1.DE', name: 'DAX ETF' },
    { symbol: 'VWRL.AS', name: 'Vanguard World' },
    { symbol: 'EUNL.DE', name: 'iShares MSCI World' },
  ],
  'Weitere': [
    { symbol: 'NESN.SW', name: 'Nestlé' },
    { symbol: 'ASML.AS', name: 'ASML' },
    { symbol: 'MC.PA', name: 'LVMH' },
    { symbol: 'NOVO-B.CO', name: 'Novo Nordisk' },
    { symbol: 'BTC-USD', name: 'Bitcoin' },
    { symbol: 'ETH-USD', name: 'Ethereum' },
    { symbol: 'GC=F', name: 'Gold' },
    { symbol: 'EURUSD=X', name: 'EUR/USD' },
  ],
}

export const CACHE_TTL = {
  quote: 60_000,
  daily: 3_600_000,
  intraday: 900_000,
  search: 86_400_000,
}
