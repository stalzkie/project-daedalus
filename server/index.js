// dotenv MUST be the first import — populates process.env before any route runs.
import 'dotenv/config'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import app from './app.js'
import { getLatestLaunches } from './routes/launches.js'

const PORT = process.env.PORT || 3001

const httpServer = createServer(app)

// ── WebSocket — real-time push for the Dashboard ────────────────────────────
const wss = new WebSocketServer({ server: httpServer, path: '/ws' })
const wsClients = new Set()

wss.on('connection', (ws) => {
  wsClients.add(ws)

  // Send current data immediately on connect
  getLatestLaunches()
    .then(data => ws.send(JSON.stringify({ type: 'LAUNCHES_UPDATE', data, fetchedAt: new Date().toISOString() })))
    .catch(() => {})

  ws.on('close', () => wsClients.delete(ws))
  ws.on('error', () => wsClients.delete(ws))
})

// Broadcast updated data every 60 s
setInterval(async () => {
  if (wsClients.size === 0) return
  try {
    const data = await getLatestLaunches()
    const payload = JSON.stringify({ type: 'LAUNCHES_UPDATE', data, fetchedAt: new Date().toISOString() })
    for (const client of wsClients) {
      if (client.readyState === 1) client.send(payload)
    }
  } catch (_) {}
}, 60_000)

httpServer.listen(PORT, () => {
  const key   = process.env.VITE_LL2_API_KEY
  const limit = process.env.LL2_RATE_LIMIT || '15'
  console.log(`[Daedalus] API server  → http://localhost:${PORT}`)
  console.log(`[Daedalus] WebSocket   → ws://localhost:${PORT}/ws`)
  console.log(`[Daedalus] LL2 auth    → ${key ? `Token ${key.slice(0, 6)}… (${limit} req/hr)` : 'ANONYMOUS — set VITE_LL2_API_KEY in .env'}`)
})
