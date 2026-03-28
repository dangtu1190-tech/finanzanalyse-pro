import { useEffect, useState } from 'react'
import { getQuote } from '@/api/dataProvider'
import { SECTOR_ETFS } from '@/config/constants'
import type { Quote } from '@/types/market'
import { formatPercent, formatCurrency } from '@/utils/formatters'
import { Card } from '@/components/ui/Card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export function SectorPerformance() {
  const [sectorData, setSectorData] = useState<{ name: string; change: number; price: number }[]>([])

  useEffect(() => {
    const entries = Object.entries(SECTOR_ETFS)
    Promise.all(
      entries.map(async ([name, symbol]) => {
        const q = await getQuote(symbol)
        return { name, change: q.changePercent, price: q.price }
      })
    ).then((data) => setSectorData(data.sort((a, b) => b.change - a.change)))
  }, [])

  return (
    <Card title="Sektor-Performance">
      <div className="h-80">
        <ResponsiveContainer>
          <BarChart data={sectorData} layout="vertical" margin={{ left: 80 }}>
            <XAxis type="number" tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(v: any) => formatPercent(Number(v))}
              contentStyle={{ backgroundColor: '#1a1d29', border: '1px solid #2a2d3a', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
              itemStyle={{ color: '#94a3b8' }}
            />
            <Bar dataKey="change" radius={[0, 4, 4, 0]}>
              {sectorData.map((entry, i) => (
                <Cell key={i} fill={entry.change >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
