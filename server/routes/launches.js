import { Router } from 'express'
import { fetchWithCache, TTL, getBudgetStatus } from '../cacheManager.js'
import { ll2 } from '../lib/ll2Client.js'

const router = Router()

// mode=detailed returns the full rocket configuration inline — no separate enrichment needed
const LL2_UPCOMING = '/launch/upcoming/?limit=10&include_suborbital=false&mode=detailed'

async function fetchUpcoming() {
  const { data } = await ll2.getUrl(
    `https://ll.thespacedevs.com/2.2.0${LL2_UPCOMING}`
  )
  return data
}

router.get('/upcoming', async (req, res) => {
  try {
    const { data, fromCache, stale, budget } = await fetchWithCache(
      'upcoming',
      fetchUpcoming,
      { fresh: TTL.UPCOMING_FRESH, stale: TTL.UPCOMING_STALE },
    )
    return res.json({
      ...data,
      _meta: { fetchedAt: data._meta?.fetchedAt ?? new Date().toISOString(), source: 'LL2 v2.2.0', fromCache, stale, budget },
    })
  } catch (err) {
    if (err.isRateLimit) return res.status(429).json({ error: 'rate_limit', message: err.message, budget: err.budget })
    console.error('[Upcoming] Fetch failed:', err.response?.status, err.message)
    res.status(502).json({ error: 'fetch_failed', message: err.message })
  }
})

export async function getLatestLaunches() {
  const { data, fromCache, stale, budget } = await fetchWithCache(
    'upcoming',
    fetchUpcoming,
    { fresh: TTL.UPCOMING_FRESH, stale: TTL.UPCOMING_STALE },
    { backgroundRefresh: false },
  )
  return { ...data, _meta: { fetchedAt: new Date().toISOString(), source: 'LL2 v2.2.0', fromCache, stale, budget } }
}

export { router as launchesRouter }
