// dotenv/config MUST be the first import — it runs as a side-effect before
// any other module in the graph is evaluated, so process.env is fully
// populated before ll2Client, cacheManager, or any route is touched.
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { launchesRouter, getLatestLaunches } from './routes/launches.js'
import { historyRouter } from './routes/history.js'
import { vehiclesRouter } from './routes/vehicles.js'
import { tleRouter } from './routes/tle.js'
import { failuresRouter } from './routes/failures.js'
import { orbitRouter }   from './routes/orbit.js'
import { getBudgetStatus, cacheStats } from './cacheManager.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/launches', launchesRouter)
app.use('/api/launches', historyRouter)
app.use('/api/launches', vehiclesRouter)
app.use('/api/tle',      tleRouter)
app.use('/api/failures', failuresRouter)
app.use('/api/orbit',   orbitRouter)

app.get('/api/status', (_req, res) => {
  res.json({ budget: getBudgetStatus(), cache: cacheStats(), ts: new Date().toISOString() })
})

const httpServer = createServer(app)

// WebSocket server for real-time status push
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

// Broadcast updated data every 60s to all connected clients
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
  console.log(`[Daedalus] API server running on http://localhost:${PORT}`)
  console.log(`[Daedalus] WebSocket available at ws://localhost:${PORT}/ws`)
  console.log(`[Daedalus] LL2 auth: ${key ? `Token ${key.slice(0, 6)}… (${limit} req/hr)` : 'ANONYMOUS — set VITE_LL2_API_KEY in .env'}`)
})
