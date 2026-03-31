# FinanzAnalyse Pro

Trading-Analyse-Plattform mit Auto-Trader Bot und IBKR-Integration.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 8, TailwindCSS 4, Zustand (State)
- **Backend:** Node.js (server.js), kein Framework — pures `http.createServer`
- **Charts:** lightweight-charts, recharts
- **Broker:** Interactive Brokers (IBKR) via Client Portal REST API
- **Marktdaten:** Yahoo Finance (kostenlos, server-side proxy)

## Befehle

```bash
npm run dev      # Vite Dev-Server (nur Frontend, Port 5173)
npm run build    # TypeScript check + Vite Build → dist/
npm start        # Production: server.js + Auto-Trader (Port 3000)
npm run lint     # ESLint
```

## Architektur

### Frontend (`src/`)
- `pages/` — Route-Pages (Dashboard, AutoTrader, Backtest, Chart, Portfolio, Sector, Settings)
- `components/` — UI-Komponenten (Charts, Alerts, Layout)
- `store/` — Zustand Stores (Market, Portfolio, Settings, Watchlist)
- `services/` — Business-Logik (signalEngine, backtestEngine, alertManager, analyst)
- `api/` — Datenprovider (Yahoo Finance Proxy, Caching)
- `types/` — TypeScript Types
- `config/` — Konfiguration
- `i18n/` — Internationalisierung (DE/EN)
- Path-Alias: `@` → `src/`

### Backend (Root)
- `server.js` — HTTP-Server, API-Routen, Yahoo-Proxy, SPA-Fallback
- `autotrader.js` — Trading-Bot (3 Strategien, 15-Min-Intervall, IBKR-Ausführung)
- `ibkr.js` — IBKR Client Portal API Client (Orders, Positionen, Auth)
- `alpaca.js` — Alpaca API Client (Legacy, nicht mehr aktiv)
- `pro-signals.js` — Sektor-Rotation, Institutional Detection, Smart Sizing
- `backtest-v4.js` — 5-Jahres-Backtesting (SMA200, V4 Strict, Momentum V2)
- `demo-simulation.js` — Trading-Simulation mit echten Yahoo-Kursen

### Daten
- `autotrader-data.json` — Persistenz: Portfolio, Trades, Config, Stats
- Kein `.env` — Broker-Credentials werden über das Dashboard konfiguriert

## Trading-Strategien

Der Auto-Trader wählt automatisch basierend auf Symbol-Typ:
- **SMA200** — Hebel-ETFs (TQQQ, UPRO): Kaufen/Verkaufen bei SMA200-Kreuzung
- **V4 Strict** — Einzelaktien (NVDA, AAPL, SAP.DE): 4/5 Konfirmationen nötig
- **Momentum V2** — Reguläre ETFs (SPY, QQQ): EMA10 + SMA50 + RSI + MACD

## API-Endpunkte

```
GET  /api/autotrader          — Bot-Status, Portfolio, Trades
POST /api/autotrader/config   — Config aktualisieren
POST /api/autotrader/reset    — Portfolio zurücksetzen
POST /api/autotrader/run      — Manueller Check-Zyklus
POST /api/ibkr/test           — IBKR Gateway Verbindungstest
GET  /api/yahoo/v8/finance/chart/:symbol — Yahoo Finance Proxy
GET  /api/yahoo-search?q=     — Symbol-Suche
```

## Konventionen

- Sprache im Code: Englisch (Variablen, Funktionen)
- Sprache in der UI: Deutsch
- Console-Logs mit Prefix: `[AUTO-TRADER]`, `[IBKR]`, `[SEKTOR]`
- Module: ES Modules (`import/export`), `"type": "module"` in package.json
- Kein ORM, kein Framework — alles minimal und direkt
