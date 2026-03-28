import { useEffect, useState } from 'react'
import { getQuote } from '@/api/dataProvider'
import { SECTOR_ETFS } from '@/config/constants'
import type { Quote } from '@/types/market'
import { formatPercent } from '@/utils/formatters'
import { Card } from '@/components/ui/Card'
import { useMarketStore } from '@/store/useMarketStore'
import { useNavigate } from 'react-router-dom'

export function SectorHeatmap() {
  const [sectorData, setSectorData] = useState<(Quote & { sectorName: string })[]>([])
  const setCurrentSymbol = useMarketStore((s) => s.setCurrentSymbol)
  const navigate = useNavigate()

  useEffect(() => {
    const entries = Object.entries(SECTOR_ETFS)
    Promise.all(
      entries.map(async ([name, symbol]) => {
        const quote = await getQuote(symbol)
        return { ...quote, sectorName: name }
      })
    ).then(setSectorData)
  }, [])

  function getHeatColor(change: number): string {
    if (change > 2) return 'bg-green-600'
    if (change > 1) return 'bg-green-500'
    if (change > 0) return 'bg-green-400/70'
    if (change > -1) return 'bg-red-400/70'
    if (change > -2) return 'bg-red-500'
    return 'bg-red-600'
  }

  return (
    <Card title="Sektor-Heatmap">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
        {sectorData
          .sort((a, b) => b.changePercent - a.changePercent)
          .map((sector) => (
            <button
              key={sector.symbol}
              onClick={() => { setCurrentSymbol(sector.symbol); navigate('/chart') }}
              className={`rounded-lg p-3 text-white transition-transform hover:scale-105 ${getHeatColor(sector.changePercent)}`}
            >
              <div className="text-sm font-bold">{sector.sectorName}</div>
              <div className="text-xs opacity-80">{sector.symbol}</div>
              <div className="mt-1 text-lg font-bold">{formatPercent(sector.changePercent)}</div>
            </button>
          ))}
      </div>
    </Card>
  )
}
