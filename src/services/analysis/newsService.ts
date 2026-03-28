export interface NewsItem {
  title: string
  summary: string
  source: string
  url: string
  publishedAt: string
  sentiment: 'positive' | 'negative' | 'neutral'
  symbol?: string
}

// Alpha Vantage News Sentiment API (free tier)
export async function fetchNews(symbol?: string): Promise<NewsItem[]> {
  const apiKey = localStorage.getItem('av_api_key') || 'demo'
  const params = new URLSearchParams({
    function: 'NEWS_SENTIMENT',
    apikey: apiKey,
    ...(symbol ? { tickers: symbol } : {}),
    limit: '20',
  })

  try {
    const res = await fetch(`https://www.alphavantage.co/query?${params}`)
    const data = await res.json()

    if (data.feed) {
      return data.feed.slice(0, 15).map((item: any) => ({
        title: item.title || '',
        summary: item.summary || '',
        source: item.source || '',
        url: item.url || '#',
        publishedAt: item.time_published || '',
        sentiment: parseSentiment(item.overall_sentiment_score),
        symbol,
      }))
    }
  } catch { /* fallback below */ }

  // Demo/fallback news
  return generateDemoNews(symbol)
}

function parseSentiment(score: number | undefined): 'positive' | 'negative' | 'neutral' {
  if (!score) return 'neutral'
  if (score > 0.15) return 'positive'
  if (score < -0.15) return 'negative'
  return 'neutral'
}

function generateDemoNews(symbol?: string): NewsItem[] {
  const s = symbol || 'Markt'
  const now = new Date()
  return [
    {
      title: `${s}: Analysten erhöhen Kursziel nach starken Quartalszahlen`,
      summary: `Mehrere Analysten haben ihre Kursziele für ${s} angehoben, nachdem das Unternehmen die Erwartungen im letzten Quartal übertroffen hat.`,
      source: 'MarketWatch', url: '#', sentiment: 'positive',
      publishedAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
    },
    {
      title: `Fed-Protokoll deutet auf Zinspause hin — Märkte reagieren positiv`,
      summary: 'Die Federal Reserve signalisiert eine mögliche Pause bei den Zinserhöhungen, was den Aktienmärkten Auftrieb gibt.',
      source: 'Reuters', url: '#', sentiment: 'positive',
      publishedAt: new Date(now.getTime() - 5 * 3600000).toISOString(),
    },
    {
      title: `${s}: Wettbewerb verschärft sich im Kerngeschäft`,
      summary: `Neue Konkurrenten setzen ${s} unter Druck. Marktanteile könnten in den kommenden Quartalen sinken.`,
      source: 'Bloomberg', url: '#', sentiment: 'negative',
      publishedAt: new Date(now.getTime() - 8 * 3600000).toISOString(),
    },
    {
      title: `Technologie-Sektor zeigt gemischte Signale zum Quartalswechsel`,
      summary: 'Während einige Tech-Werte neue Höchststände erreichen, bleiben andere hinter den Erwartungen zurück.',
      source: 'CNBC', url: '#', sentiment: 'neutral',
      publishedAt: new Date(now.getTime() - 12 * 3600000).toISOString(),
    },
    {
      title: `${s}: Insider-Käufe deuten auf Zuversicht des Managements hin`,
      summary: `Mehrere Vorstandsmitglieder von ${s} haben in den letzten Wochen eigene Aktien gekauft.`,
      source: 'Barron\'s', url: '#', sentiment: 'positive',
      publishedAt: new Date(now.getTime() - 24 * 3600000).toISOString(),
    },
    {
      title: `Konjunktursorgen belasten europäische Märkte`,
      summary: 'Schwache Wirtschaftsdaten aus der Eurozone drücken auf die Stimmung der Anleger.',
      source: 'Handelsblatt', url: '#', sentiment: 'negative',
      publishedAt: new Date(now.getTime() - 30 * 3600000).toISOString(),
    },
    {
      title: `${s}: Neues Produkt könnte Wachstumstreiber werden`,
      summary: `Das neu angekündigte Produkt von ${s} könnte laut Branchenexperten den Umsatz signifikant steigern.`,
      source: 'TechCrunch', url: '#', sentiment: 'positive',
      publishedAt: new Date(now.getTime() - 48 * 3600000).toISOString(),
    },
  ]
}

export function formatNewsDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffH = Math.floor(diffMs / 3600000)

  if (diffH < 1) return 'Gerade eben'
  if (diffH < 24) return `Vor ${diffH} Std.`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `Vor ${diffD} Tag${diffD > 1 ? 'en' : ''}`
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}
