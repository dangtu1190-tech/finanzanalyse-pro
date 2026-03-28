import { useEffect, useMemo } from 'react'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { getQuote } from '@/api/dataProvider'
import { formatCurrency, formatPercent } from '@/utils/formatters'
import { Card } from '@/components/ui/Card'
import { TrendingUp, TrendingDown, DollarSign, PieChart } from 'lucide-react'
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export function PortfolioDashboard() {
  const { positions, updatePositionPrice } = usePortfolioStore()

  useEffect(() => {
    positions.forEach((pos) => {
      getQuote(pos.symbol).then((q) => updatePositionPrice(pos.symbol, q.price))
    })
  }, [positions.length])

  const summary = useMemo(() => {
    let totalValue = 0
    let totalCost = 0
    for (const pos of positions) {
      const currentVal = (pos.currentPrice || pos.entryPrice) * pos.quantity
      totalValue += currentVal
      totalCost += pos.entryPrice * pos.quantity
    }
    const totalPnL = totalValue - totalCost
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0
    return { totalValue, totalCost, totalPnL, totalPnLPercent }
  }, [positions])

  const allocationData = useMemo(() => {
    return positions.map((pos) => ({
      name: pos.symbol,
      value: (pos.currentPrice || pos.entryPrice) * pos.quantity,
    }))
  }, [positions])

  if (positions.length === 0) {
    return (
      <Card className="py-12 text-center">
        <PieChart size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
        <div className="text-lg font-medium text-gray-500 dark:text-gray-400">
          Noch keine Positionen
        </div>
        <div className="mt-1 text-sm text-gray-400 dark:text-gray-500">
          Füge über den Button oben neue Positionen hinzu
        </div>
      </Card>
    )
  }

  const isPositivePnL = summary.totalPnL >= 0

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-blue-500" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Gesamtwert</span>
          </div>
          <div className="mt-2 text-2xl font-bold dark:text-white">{formatCurrency(summary.totalValue)}</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            {isPositivePnL ? <TrendingUp size={18} className="text-green-500" /> : <TrendingDown size={18} className="text-red-500" />}
            <span className="text-sm text-gray-500 dark:text-gray-400">Gesamt G&V</span>
          </div>
          <div className={`mt-2 text-2xl font-bold ${isPositivePnL ? 'text-green-500' : 'text-red-500'}`}>
            {formatCurrency(summary.totalPnL)}
          </div>
          <div className={`text-sm ${isPositivePnL ? 'text-green-500' : 'text-red-500'}`}>
            {formatPercent(summary.totalPnLPercent)}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <PieChart size={18} className="text-purple-500" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Positionen</span>
          </div>
          <div className="mt-2 text-2xl font-bold dark:text-white">{positions.length}</div>
        </Card>
      </div>

      {/* Allocation Pie */}
      {allocationData.length > 0 && (
        <Card title="Allokation">
          <div className="h-64">
            <ResponsiveContainer>
              <RechartsPie>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {allocationData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Positions Table */}
      <Card title="Positionen">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="pb-2 text-left font-medium text-gray-500 dark:text-gray-400">Symbol</th>
                <th className="pb-2 text-right font-medium text-gray-500 dark:text-gray-400">Anzahl</th>
                <th className="pb-2 text-right font-medium text-gray-500 dark:text-gray-400">Einstieg</th>
                <th className="pb-2 text-right font-medium text-gray-500 dark:text-gray-400">Aktuell</th>
                <th className="pb-2 text-right font-medium text-gray-500 dark:text-gray-400">G&V</th>
                <th className="pb-2 text-right font-medium text-gray-500 dark:text-gray-400">G&V %</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => {
                const current = pos.currentPrice || pos.entryPrice
                const pnl = (current - pos.entryPrice) * pos.quantity
                const pnlPercent = ((current - pos.entryPrice) / pos.entryPrice) * 100
                const isPosPositive = pnl >= 0
                return (
                  <tr key={pos.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 font-semibold dark:text-white">{pos.symbol}</td>
                    <td className="py-2 text-right dark:text-gray-300">{pos.quantity}</td>
                    <td className="py-2 text-right dark:text-gray-300">{formatCurrency(pos.entryPrice)}</td>
                    <td className="py-2 text-right dark:text-gray-300">{formatCurrency(current)}</td>
                    <td className={`py-2 text-right font-semibold ${isPosPositive ? 'text-green-500' : 'text-red-500'}`}>
                      {formatCurrency(pnl)}
                    </td>
                    <td className={`py-2 text-right font-semibold ${isPosPositive ? 'text-green-500' : 'text-red-500'}`}>
                      {formatPercent(pnlPercent)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
