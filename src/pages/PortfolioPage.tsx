import { useState } from 'react'
import { PortfolioDashboard } from '@/components/portfolio/PortfolioDashboard'
import { AddPositionModal } from '@/components/portfolio/AddPositionModal'
import { Button } from '@/components/ui/Button'
import { Briefcase, Plus } from 'lucide-react'

export function PortfolioPage() {
  const [showAddModal, setShowAddModal] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase size={24} className="text-blue-500" />
          <h1 className="text-2xl font-bold dark:text-white">Portfolio</h1>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus size={16} className="mr-1" />
          Position hinzufügen
        </Button>
      </div>

      <PortfolioDashboard />
      <AddPositionModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  )
}
