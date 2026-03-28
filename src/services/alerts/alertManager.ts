import { getStorage, setStorage } from '@/utils/storage'

export type AlertCondition = 'above' | 'below' | 'crosses_above' | 'crosses_below'
export type AlertIndicator = 'price' | 'rsi' | 'sma20' | 'sma50' | 'volume'

export interface Alert {
  id: string
  symbol: string
  indicator: AlertIndicator
  condition: AlertCondition
  value: number
  active: boolean
  triggered: boolean
  triggeredAt?: string
  createdAt: string
  message?: string
}

export interface AlertNotification {
  id: string
  alertId: string
  symbol: string
  message: string
  timestamp: string
  read: boolean
}

const ALERTS_KEY = 'fa-alerts'
const NOTIFICATIONS_KEY = 'fa-notifications'

export function getAlerts(): Alert[] {
  return getStorage<Alert[]>(ALERTS_KEY, [])
}

export function saveAlerts(alerts: Alert[]): void {
  setStorage(ALERTS_KEY, alerts)
}

export function addAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'triggered'>): Alert {
  const alerts = getAlerts()
  const newAlert: Alert = {
    ...alert,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    triggered: false,
  }
  alerts.push(newAlert)
  saveAlerts(alerts)
  return newAlert
}

export function removeAlert(id: string): void {
  const alerts = getAlerts().filter(a => a.id !== id)
  saveAlerts(alerts)
}

export function toggleAlert(id: string): void {
  const alerts = getAlerts().map(a =>
    a.id === id ? { ...a, active: !a.active } : a
  )
  saveAlerts(alerts)
}

export function getNotifications(): AlertNotification[] {
  return getStorage<AlertNotification[]>(NOTIFICATIONS_KEY, [])
}

export function addNotification(alertId: string, symbol: string, message: string): void {
  const notifications = getNotifications()
  notifications.unshift({
    id: crypto.randomUUID(),
    alertId,
    symbol,
    message,
    timestamp: new Date().toISOString(),
    read: false,
  })
  // Keep only last 50
  setStorage(NOTIFICATIONS_KEY, notifications.slice(0, 50))
}

export function markNotificationRead(id: string): void {
  const notifications = getNotifications().map(n =>
    n.id === id ? { ...n, read: true } : n
  )
  setStorage(NOTIFICATIONS_KEY, notifications)
}

export function clearNotifications(): void {
  setStorage(NOTIFICATIONS_KEY, [])
}

export function checkAlerts(
  symbol: string,
  currentPrice: number,
  rsiValue?: number,
  sma20Value?: number,
  sma50Value?: number,
  volume?: number
): AlertNotification[] {
  const alerts = getAlerts()
  const triggered: AlertNotification[] = []

  for (const alert of alerts) {
    if (!alert.active || alert.symbol !== symbol || alert.triggered) continue

    let currentValue: number | undefined
    switch (alert.indicator) {
      case 'price': currentValue = currentPrice; break
      case 'rsi': currentValue = rsiValue; break
      case 'sma20': currentValue = sma20Value; break
      case 'sma50': currentValue = sma50Value; break
      case 'volume': currentValue = volume; break
    }

    if (currentValue === undefined) continue

    let isTriggered = false
    switch (alert.condition) {
      case 'above':
      case 'crosses_above':
        isTriggered = currentValue >= alert.value
        break
      case 'below':
      case 'crosses_below':
        isTriggered = currentValue <= alert.value
        break
    }

    if (isTriggered) {
      alert.triggered = true
      alert.triggeredAt = new Date().toISOString()

      const conditionLabel = {
        above: 'über', below: 'unter',
        crosses_above: 'kreuzt über', crosses_below: 'kreuzt unter',
      }[alert.condition]

      const indicatorLabel = {
        price: 'Preis', rsi: 'RSI', sma20: 'SMA20', sma50: 'SMA50', volume: 'Volumen',
      }[alert.indicator]

      const message = alert.message ||
        `${symbol}: ${indicatorLabel} ist ${conditionLabel} ${alert.value} (aktuell: ${currentValue.toFixed(2)})`

      addNotification(alert.id, symbol, message)
      triggered.push({
        id: crypto.randomUUID(),
        alertId: alert.id,
        symbol,
        message,
        timestamp: new Date().toISOString(),
        read: false,
      })

      // Browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`FinanzPro Alert: ${symbol}`, { body: message })
      }
    }
  }

  saveAlerts(alerts)
  return triggered
}

export function requestNotificationPermission(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

export function getConditionLabel(condition: AlertCondition): string {
  return { above: 'Über', below: 'Unter', crosses_above: 'Kreuzt über', crosses_below: 'Kreuzt unter' }[condition]
}

export function getIndicatorLabel(indicator: AlertIndicator): string {
  return { price: 'Preis', rsi: 'RSI', sma20: 'SMA 20', sma50: 'SMA 50', volume: 'Volumen' }[indicator]
}
