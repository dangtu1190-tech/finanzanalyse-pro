interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

const memoryCache = new Map<string, CacheEntry<unknown>>()

export function getCached<T>(key: string): T | null {
  // Try memory first
  const mem = memoryCache.get(key) as CacheEntry<T> | undefined
  if (mem && Date.now() - mem.timestamp < mem.ttl) {
    return mem.data
  }

  // Try sessionStorage
  try {
    const stored = sessionStorage.getItem(`cache:${key}`)
    if (stored) {
      const entry = JSON.parse(stored) as CacheEntry<T>
      if (Date.now() - entry.timestamp < entry.ttl) {
        memoryCache.set(key, entry)
        return entry.data
      }
      sessionStorage.removeItem(`cache:${key}`)
    }
  } catch { /* ignore */ }

  return null
}

export function setCache<T>(key: string, data: T, ttl: number): void {
  const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl }
  memoryCache.set(key, entry as CacheEntry<unknown>)

  try {
    sessionStorage.setItem(`cache:${key}`, JSON.stringify(entry))
  } catch { /* storage full */ }
}

export function clearCache(): void {
  memoryCache.clear()
  try {
    const keys = Object.keys(sessionStorage).filter(k => k.startsWith('cache:'))
    keys.forEach(k => sessionStorage.removeItem(k))
  } catch { /* ignore */ }
}
