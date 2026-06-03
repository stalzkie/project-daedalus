/**
 * Express application — imported by both:
 *   server/index.js  (local dev: adds WebSocket + HTTP listen)
 *   api/server.js    (Vercel: exported as a serverless function handler)
 */
import express from 'express'
import cors    from 'cors'
import { launchesRouter } from './routes/launches.js'
import { historyRouter }  from './routes/history.js'
import { vehiclesRouter } from './routes/vehicles.js'
import { tleRouter }      from './routes/tle.js'
import { failuresRouter } from './routes/failures.js'
import { orbitRouter }    from './routes/orbit.js'
import { getBudgetStatus, cacheStats } from './cacheManager.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/launches', launchesRouter)
app.use('/api/launches', historyRouter)
app.use('/api/launches', vehiclesRouter)
app.use('/api/tle',      tleRouter)
app.use('/api/failures', failuresRouter)
app.use('/api/orbit',    orbitRouter)

app.get('/api/status', (_req, res) => {
  res.json({ budget: getBudgetStatus(), cache: cacheStats(), ts: new Date().toISOString() })
})

export default app
