import { useEffect, useCallback } from 'react'
import { useMarketStore } from '@/store/useMarketStore'
import { getHistoricalData, getQuote } from '@/api/dataProvider'

export function useMarketData() {
  const {
    currentSymbol, timeframe, setOHLCV, setQuote, setLoading, setError,
  } = useMarketStore()

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ohlcv, quote] = await Promise.all([
        getHistoricalData(currentSymbol, timeframe),
        getQuote(currentSymbol),
      ])
      setOHLCV(ohlcv)
      setQuote(quote)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Daten')
    } finally {
      setLoading(false)
    }
  }, [currentSymbol, timeframe, setOHLCV, setQuote, setLoading, setError])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { refetch: fetchData }
}
