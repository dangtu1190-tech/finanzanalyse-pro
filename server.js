import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '3000')
const DIST = join(__dirname, 'dist')

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const indexHtml = readFileSync(join(DIST, 'index.html'))

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)

  // Yahoo Finance chart proxy
  if (url.pathname.startsWith('/api/yahoo/v8/finance/chart/')) {
    const symbol = url.pathname.split('/').pop()
    const params = url.searchParams.toString()
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}${params ? '?' + params : ''}`

    try {
      const response = await fetch(yahooUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      })
      const data = await response.text()
      res.writeHead(response.status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      })
      res.end(data)
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Yahoo fetch failed' }))
    }
    return
  }

  // Yahoo Finance search proxy
  if (url.pathname === '/api/yahoo-search') {
    const q = url.searchParams.get('q')
    if (!q) { res.writeHead(400); res.end('Missing q'); return }

    const yahooUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`
    try {
      const response = await fetch(yahooUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      })
      const data = await response.text()
      res.writeHead(response.status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      })
      res.end(data)
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Yahoo search failed' }))
    }
    return
  }

  // Static files from dist/
  const filePath = join(DIST, url.pathname === '/' ? 'index.html' : url.pathname)
  if (existsSync(filePath) && !filePath.includes('..')) {
    const ext = extname(filePath)
    const mime = MIME[ext] || 'application/octet-stream'
    try {
      const content = readFileSync(filePath)
      res.writeHead(200, { 'Content-Type': mime })
      res.end(content)
      return
    } catch { /* fall through to SPA */ }
  }

  // SPA fallback: serve index.html
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(indexHtml)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`FinanzAnalyse Pro running on 0.0.0.0:${PORT}`)
})
