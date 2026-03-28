import { useEffect, useState } from 'react'
import { fetchNews, formatNewsDate, type NewsItem } from '@/services/analysis/newsService'
import { Card } from '@/components/ui/Card'
import { Newspaper, TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react'

interface NewsFeedProps {
  symbol?: string
}

export function NewsFeed({ symbol }: NewsFeedProps) {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchNews(symbol).then(items => {
      setNews(items)
      setLoading(false)
    })
  }, [symbol])

  const sentimentIcon = {
    positive: <TrendingUp size={14} className="text-green-500" />,
    negative: <TrendingDown size={14} className="text-red-500" />,
    neutral: <Minus size={14} className="text-gray-400" />,
  }

  const sentimentBg = {
    positive: 'border-l-green-500',
    negative: 'border-l-red-500',
    neutral: 'border-l-gray-300 dark:border-l-gray-600',
  }

  return (
    <Card
      title="Nachrichten"
      action={
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Newspaper size={12} />
          <span>{symbol || 'Markt'}</span>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="mt-2 h-3 w-full rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {news.map((item, i) => (
            <a
              key={i}
              href={item.url !== '#' ? item.url : undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={`block rounded-lg border-l-2 bg-gray-50 p-3 transition-colors hover:bg-gray-100 dark:bg-[var(--color-bg-hover-dark)] dark:hover:bg-gray-700 ${sentimentBg[item.sentiment]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {sentimentIcon[item.sentiment]}
                    <h4 className="text-sm font-medium leading-tight dark:text-white">
                      {item.title}
                    </h4>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                    {item.summary}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                    <span className="font-medium">{item.source}</span>
                    <span>·</span>
                    <span>{formatNewsDate(item.publishedAt)}</span>
                  </div>
                </div>
                {item.url !== '#' && (
                  <ExternalLink size={14} className="mt-1 shrink-0 text-gray-300" />
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Sentiment Summary */}
      {!loading && news.length > 0 && (
        <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Stimmung:</span>
          <div className="flex gap-2">
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {news.filter(n => n.sentiment === 'positive').length} Positiv
            </span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {news.filter(n => n.sentiment === 'neutral').length} Neutral
            </span>
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {news.filter(n => n.sentiment === 'negative').length} Negativ
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}
