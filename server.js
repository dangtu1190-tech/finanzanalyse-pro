import { createServer } from 'http'
import { readFileSync, existsSync, statSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '3000')
const DIST = join(__dirname, 'dist')

console.log(`[boot] __dirname: ${__dirname}`)
console.log(`[boot] DIST: ${DIST}`)
console.log(`[boot] dist exists: ${existsSync(DIST)}`)
console.log(`[boot] index.html exists: ${existsSync(join(DIST, 'index.html'))}`)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
}

function getIndexHtml() {
  const p = join(DIST, 'index.html')
  if (existsSync(p)) return readFileSync(p)
  return Buffer.from('<html><body><h1>Build not found. Run npm run build first.</h1></body></html>')
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)
  console.log(`[req] ${req.method} ${url.pathname}`)

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }

  // Yahoo Finance chart proxy
  if (url.pathname.startsWith('/api/yahoo/v8/finance/chart/')) {
    const symbol = decodeURIComponent(url.pathname.split('/').pop() || '')
    const params = url.searchParams.toString()
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}${params ? '?' + params : ''}`
    console.log(`[proxy] ${yahooUrl}`)

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
    } catch (err) {
      console.error(`[proxy error]`, err)
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
    } catch (err) {
      console.error(`[search error]`, err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Yahoo search failed' }))
    }
    return
  }

  // Static files from dist/
  if (url.pathname !== '/' && !url.pathname.startsWith('/api/')) {
    const filePath = join(DIST, url.pathname)
    // Prevent directory traversal
    if (filePath.startsWith(DIST) && existsSync(filePath)) {
      try {
        const stat = statSync(filePath)
        if (stat.isFile()) {
          const ext = extname(filePath)
          const mime = MIME[ext] || 'application/octet-stream'
          const content = readFileSync(filePath)
          res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000' })
          res.end(content)
          return
        }
      } catch { /* fall through */ }
    }
  }

  // SPA fallback
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(getIndexHtml())
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[start] FinanzAnalyse Pro running on 0.0.0.0:${PORT}`)
})

server.on('error', (err) => {
  console.error('[server error]', err)
})

process.on('uncaughtException', (err) => {
  console.error('[uncaught]', err)
})
