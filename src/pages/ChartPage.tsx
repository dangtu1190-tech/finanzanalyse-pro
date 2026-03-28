import { useMarketData } from '@/hooks/useMarketData'
import { QuoteHeader } from '@/components/market/QuoteHeader'
import { ChartContainer } from '@/components/chart/ChartContainer'
import { SignalDashboard } from '@/components/signals/SignalDashboard'
import { LineChart } from 'lucide-react'
import { useMarketStore } from '@/store/useMarketStore'

export function ChartPage() {
  useMarketData()
  const currentSymbol = useMarketStore((s) => s.currentSymbol)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <LineChart size={24} className="text-blue-500" />
        <h1 className="text-2xl font-bold dark:text-white">Chart-Analyse — {currentSymbol}</h1>
      </div>

      <QuoteHeader />

      <div className="grid gap-4 xl:grid-cols-[1fr_350px]">
        {/* Main Chart */}
        <ChartContainer />

        {/* Signal Panel */}
        <SignalDashboard />
      </div>
    </div>
  )
}
