import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

// Serve static files from dist/
app.use(express.static(join(__dirname, 'dist')))

// Yahoo Finance chart proxy endpoint
app.get('/api/yahoo/v8/finance/chart/:symbol', async (req, res) => {
  const { symbol } = req.params
  const queryString = new URLSearchParams(req.query).toString()
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}${queryString ? '?' + queryString : ''}`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      return res.status(response.status).json({ error: `Yahoo API: ${response.status}` })
    }

    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch from Yahoo Finance' })
  }
})

// Yahoo Finance search proxy
app.get('/api/yahoo-search', async (req, res) => {
  const { q } = req.query
  if (!q) return res.status(400).json({ error: 'Missing query parameter' })

  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      return res.status(response.status).json({ error: `Yahoo Search: ${response.status}` })
    }

    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to search Yahoo Finance' })
  }
})

// SPA fallback
app.get('/{path}', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`FinanzAnalyse Pro running on port ${PORT}`)
})
