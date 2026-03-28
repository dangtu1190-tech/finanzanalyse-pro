import { useState, useEffect } from 'react'
import {
  getAlerts, addAlert, removeAlert, toggleAlert,
  getNotifications, clearNotifications, markNotificationRead,
  requestNotificationPermission, getConditionLabel, getIndicatorLabel,
  type Alert, type AlertNotification, type AlertCondition, type AlertIndicator,
} from '@/services/alerts/alertManager'
import { useMarketStore } from '@/store/useMarketStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Bell, BellRing, Plus, Trash2, ToggleLeft, ToggleRight, Check } from 'lucide-react'

export function AlertPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [notifications, setNotifications] = useState<AlertNotification[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [tab, setTab] = useState<'alerts' | 'notifications'>('alerts')
  const currentSymbol = useMarketStore((s) => s.currentSymbol)

  useEffect(() => {
    setAlerts(getAlerts())
    setNotifications(getNotifications())
    requestNotificationPermission()
  }, [])

  function refreshData() {
    setAlerts(getAlerts())
    setNotifications(getNotifications())
  }

  return (
    <Card
      title="Alerts & Benachrichtigungen"
      action={
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus size={14} className="mr-1" /> Alert
        </Button>
      }
    >
      {/* Tabs */}
      <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        <button
          onClick={() => setTab('alerts')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === 'alerts'
              ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          <Bell size={12} className="mr-1 inline" /> Alerts ({alerts.length})
        </button>
        <button
          onClick={() => setTab('notifications')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === 'notifications'
              ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          <BellRing size={12} className="mr-1 inline" />
          Verlauf ({notifications.filter(n => !n.read).length})
        </button>
      </div>

      {tab === 'alerts' && (
        <div className="space-y-2">
          {alerts.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Noch keine Alerts erstellt
            </div>
          ) : (
            alerts.map(alert => (
              <div
                key={alert.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  alert.triggered
                    ? 'bg-yellow-50 dark:bg-yellow-900/10'
                    : 'bg-gray-50 dark:bg-[var(--color-bg-hover-dark)]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold dark:text-white">{alert.symbol}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {getIndicatorLabel(alert.indicator)} {getConditionLabel(alert.condition)} {alert.value}
                    </span>
                    {alert.triggered && (
                      <Check size={14} className="text-yellow-500" />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { toggleAlert(alert.id); refreshData() }}
                    className="p-1 text-gray-400 hover:text-blue-500"
                  >
                    {alert.active
                      ? <ToggleRight size={18} className="text-blue-500" />
                      : <ToggleLeft size={18} />}
                  </button>
                  <button
                    onClick={() => { removeAlert(alert.id); refreshData() }}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'notifications' && (
        <div className="space-y-2">
          {notifications.length > 0 && (
            <button
              onClick={() => { clearNotifications(); refreshData() }}
              className="text-xs text-red-500 hover:underline"
            >
              Alle löschen
            </button>
          )}
          {notifications.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Keine Benachrichtigungen
            </div>
          ) : (
            notifications.slice(0, 20).map(n => (
              <div
                key={n.id}
                onClick={() => { markNotificationRead(n.id); refreshData() }}
                className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${
                  n.read
                    ? 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    : 'bg-blue-50 font-medium dark:bg-blue-900/20 dark:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BellRing size={14} className={n.read ? 'text-gray-400' : 'text-blue-500'} />
                  <span>{n.message}</span>
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {new Date(n.timestamp).toLocaleString('de-DE')}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <AddAlertModal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); refreshData() }}
        defaultSymbol={currentSymbol}
      />
    </Card>
  )
}

function AddAlertModal({ open, onClose, defaultSymbol }: { open: boolean; onClose: () => void; defaultSymbol: string }) {
  const [symbol, setSymbol] = useState(defaultSymbol)
  const [indicator, setIndicator] = useState<AlertIndicator>('price')
  const [condition, setCondition] = useState<AlertCondition>('above')
  const [value, setValue] = useState('')

  useEffect(() => { setSymbol(defaultSymbol) }, [defaultSymbol])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!symbol || !value) return
    addAlert({ symbol: symbol.toUpperCase(), indicator, condition, value: parseFloat(value), active: true })
    setValue('')
    onClose()
  }

  const inputClass = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"

  return (
    <Modal open={open} onClose={onClose} title="Neuen Alert erstellen">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium dark:text-gray-300">Symbol</label>
          <input type="text" value={symbol} onChange={e => setSymbol(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium dark:text-gray-300">Indikator</label>
          <select value={indicator} onChange={e => setIndicator(e.target.value as AlertIndicator)} className={inputClass}>
            <option value="price">Preis</option>
            <option value="rsi">RSI</option>
            <option value="sma20">SMA 20</option>
            <option value="sma50">SMA 50</option>
            <option value="volume">Volumen</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium dark:text-gray-300">Bedingung</label>
          <select value={condition} onChange={e => setCondition(e.target.value as AlertCondition)} className={inputClass}>
            <option value="above">Über</option>
            <option value="below">Unter</option>
            <option value="crosses_above">Kreuzt über</option>
            <option value="crosses_below">Kreuzt unter</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium dark:text-gray-300">Wert</label>
          <input type="number" step="any" value={value} onChange={e => setValue(e.target.value)} placeholder="z.B. 150.00" className={inputClass} required />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} type="button">Abbrechen</Button>
          <Button type="submit">Alert erstellen</Button>
        </div>
      </form>
    </Modal>
  )
}
