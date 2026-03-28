import { SectorHeatmap } from '@/components/sector/SectorHeatmap'
import { SectorPerformance } from '@/components/sector/SectorPerformance'
import { PieChart } from 'lucide-react'

export function SectorPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <PieChart size={24} className="text-blue-500" />
        <h1 className="text-2xl font-bold dark:text-white">Sektor-Analyse</h1>
      </div>

      <SectorHeatmap />
      <SectorPerformance />
    </div>
  )
}
