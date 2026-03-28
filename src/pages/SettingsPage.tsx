import { useSettingsStore } from '@/store/useSettingsStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Settings, Sun, Moon, Globe, Key } from 'lucide-react'
import { useState } from 'react'

export function SettingsPage() {
  const { theme, toggleTheme, language, setLanguage, apiKey, setApiKey } = useSettingsStore()
  const [keyInput, setKeyInput] = useState(apiKey)
  const [saved, setSaved] = useState(false)

  function handleSaveKey() {
    setApiKey(keyInput)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Settings size={24} className="text-blue-500" />
        <h1 className="text-2xl font-bold dark:text-white">Einstellungen</h1>
      </div>

      {/* API Key */}
      <Card title="API-Schlüssel" action={
        <a
          href="https://www.alphavantage.co/support/#api-key"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline"
        >
          Kostenlosen Schlüssel holen
        </a>
      }>
        <div className="flex items-center gap-2">
          <Key size={16} className="text-gray-400" />
          <input
            type="text"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Alpha Vantage API-Schlüssel eingeben"
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <Button onClick={handleSaveKey}>
            {saved ? 'Gespeichert!' : 'Speichern'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Ohne API-Schlüssel werden Demo-Daten angezeigt. Der kostenlose Tarif erlaubt 25 Anfragen pro Tag.
        </p>
      </Card>

      {/* Theme */}
      <Card title="Design">
        <div className="flex gap-3">
          <button
            onClick={() => theme !== 'dark' && toggleTheme()}
            className={`flex flex-1 items-center gap-3 rounded-lg border p-4 transition-colors ${
              theme === 'dark'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <Moon size={20} className={theme === 'dark' ? 'text-blue-500' : 'text-gray-400'} />
            <div className="text-left">
              <div className="text-sm font-medium dark:text-white">Dunkel</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Augenfreundlich</div>
            </div>
          </button>
          <button
            onClick={() => theme !== 'light' && toggleTheme()}
            className={`flex flex-1 items-center gap-3 rounded-lg border p-4 transition-colors ${
              theme === 'light'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <Sun size={20} className={theme === 'light' ? 'text-blue-500' : 'text-gray-400'} />
            <div className="text-left">
              <div className="text-sm font-medium dark:text-white">Hell</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Klassisch</div>
            </div>
          </button>
        </div>
      </Card>

      {/* Language */}
      <Card title="Sprache">
        <div className="flex gap-3">
          <button
            onClick={() => setLanguage('de')}
            className={`flex flex-1 items-center gap-3 rounded-lg border p-4 transition-colors ${
              language === 'de'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <Globe size={20} className={language === 'de' ? 'text-blue-500' : 'text-gray-400'} />
            <div className="text-sm font-medium dark:text-white">Deutsch</div>
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`flex flex-1 items-center gap-3 rounded-lg border p-4 transition-colors ${
              language === 'en'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <Globe size={20} className={language === 'en' ? 'text-blue-500' : 'text-gray-400'} />
            <div className="text-sm font-medium dark:text-white">English</div>
          </button>
        </div>
      </Card>

      {/* Info */}
      <Card title="Über die App">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          FinanzAnalyse Pro — Professionelle technische Marktanalyse mit Kauf/Verkauf-Signalen
          basierend auf Indikator-Konfluenz. Unterstützt Aktien, ETFs und Anleihen.
        </p>
        <div className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          Datenquelle: Alpha Vantage | Charts: TradingView Lightweight Charts
        </div>
      </Card>
    </div>
  )
}
