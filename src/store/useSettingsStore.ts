import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language } from '@/i18n'

interface SettingsState {
  theme: 'dark' | 'light'
  language: Language
  apiKey: string
  toggleTheme: () => void
  setLanguage: (lang: Language) => void
  setApiKey: (key: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      language: 'de',
      apiKey: '',
      toggleTheme: () =>
        set((s) => {
          const next = s.theme === 'dark' ? 'light' : 'dark'
          document.documentElement.classList.toggle('dark', next === 'dark')
          return { theme: next }
        }),
      setLanguage: (language) => set({ language }),
      setApiKey: (apiKey) => {
        localStorage.setItem('av_api_key', apiKey)
        set({ apiKey })
      },
    }),
    { name: 'fa-settings' }
  )
)
