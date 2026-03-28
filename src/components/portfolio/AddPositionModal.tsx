import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { usePortfolioStore } from '@/store/usePortfolioStore'

interface AddPositionModalProps {
  open: boolean
  onClose: () => void
}

export function AddPositionModal({ open, onClose }: AddPositionModalProps) {
  const addPosition = usePortfolioStore((s) => s.addPosition)
  const [symbol, setSymbol] = useState('')
  const [quantity, setQuantity] = useState('')
  const [entryPrice, setEntryPrice] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [type, setType] = useState<'stock' | 'etf' | 'bond'>('stock')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!symbol || !quantity || !entryPrice) return

    addPosition({
      symbol: symbol.toUpperCase(),
      name: symbol.toUpperCase(),
      quantity: parseFloat(quantity),
      entryPrice: parseFloat(entryPrice),
      entryDate,
      type,
    })
    setSymbol('')
    setQuantity('')
    setEntryPrice('')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Position hinzufügen">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium dark:text-gray-300">Symbol</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="z.B. AAPL"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium dark:text-gray-300">Typ</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'stock' | 'etf' | 'bond')}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="stock">Aktie</option>
            <option value="etf">ETF</option>
            <option value="bond">Anleihe</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium dark:text-gray-300">Anzahl</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="10"
              step="any"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium dark:text-gray-300">Einstiegspreis</label>
            <input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder="150.00"
              step="0.01"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              required
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium dark:text-gray-300">Kaufdatum</label>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} type="button">Abbrechen</Button>
          <Button type="submit">Hinzufügen</Button>
        </div>
      </form>
    </Modal>
  )
}
