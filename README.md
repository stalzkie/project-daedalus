# Project Daedalus

A full-stack aerospace intelligence platform built for real-time launch tracking, historical analysis, orbital mechanics simulation, and launch vehicle research. Data is sourced from the Launch Library 2 (LL2) API, Space-Track.org, NASA, and Cesium Ion.

![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite) ![Express](https://img.shields.io/badge/Express-4-000000?logo=express) ![CesiumJS](https://img.shields.io/badge/CesiumJS-1.141-48B5C0)

---

## Modules

| Route | Module | Description |
|---|---|---|
| `/` | **Dashboard** | Live upcoming launches with real-time WebSocket updates, vehicle specs, launch site map, and weather |
| `/history` | **Launch History** | Paginated & filterable table of all past launches with success-rate charts, payload scatter plot, multi-launch comparison, and export |
| `/calculator` | **Δv Calculator** | Propulsion, orbital mechanics, trajectory, reentry, and multi-stage simulator tabs with formula references and PDF export |
| `/failures` | **Failure Database** | Searchable index of launch failures with taxonomy charts, timeline visualisation, and detailed incident panels |
| `/orbit/:launchId` | **3D Orbit Viewer** | Full-screen CesiumJS globe showing orbital ellipse, ground track, launch site, ascending node, and live satellite position |

---

## Tech Stack

### Frontend
- **React 18** + **React Router v6** — SPA routing
- **Vite 5** — dev server and production bundler
- **TanStack Query v5** — data fetching, caching, background revalidation
- **TanStack Table v8** — the history table (sorting, pagination, row selection)
- **Recharts** — success-rate line chart and payload scatter plot
- **CesiumJS 1.141** + **satellite.js** — 3D globe and orbital propagation (SGP4/SDP4)
- **React Leaflet** — launch site map on the dashboard
- **Tailwind CSS** — utility-first styling
- **KaTeX** — LaTeX formula rendering in the calculator
- **jsPDF** — PDF export for calculator reports

### Backend
- **Express 4** — REST API server
- **ws** — WebSocket server for real-time dashboard pushes
- **winston** — structured logging to `server/logs/`
- **File-based cache** — JSON cache in `server/cache-data/` with tiered TTLs (see below)
- **dotenv** — environment variable loading

---

## Prerequisites

- **Node.js ≥ 18**
- **npm ≥ 9**
- A free [Cesium Ion](https://ion.cesium.com/) account (for the 3D viewer basemap — falls back to bundled NaturalEarthII imagery if omitted)
- Optional: [SpaceDevs](https://thespacedevs.com/llapi) token for a higher LL2 rate limit (300 req/hr vs 15 anonymous)
- Optional: [Space-Track.org](https://www.space-track.org/) account for TLE data
- Optional: [NASA API key](https://api.nasa.gov/) for the weather widget

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/stalzkie/project-daedalus.git
cd project-daedalus
npm install        # also runs postinstall → copies Cesium assets to public/cesium/
```

### 2. Configure environment

Copy the example file and fill in your keys:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `VITE_CESIUM_TOKEN` | Recommended | Cesium Ion access token — enables Bing/World satellite imagery. Without it the viewer renders the bundled NaturalEarthII basemap. |
| `VITE_LL2_API_KEY` | Optional | SpaceDevs LL2 token. Raises rate limit from **15 req/hr** (anonymous) to **300 req/hr**. |
| `NASA_API_KEY` | Optional | NASA Open APIs key for the dashboard weather widget. |
| `SPACETRACK_USERNAME` | Optional | Space-Track.org email — enables TLE lookups for the orbit viewer. |
| `SPACETRACK_PASSWORD` | Optional | Space-Track.org password. |
| `PORT` | Optional | API server port (default `3001`). |

> **Note**: `.env` is git-ignored. Never commit it.

### 3. Run in development

```bash
npm run dev
```

This starts both servers concurrently:
- **Vite** dev server → `http://localhost:5173`
- **Express** API server → `http://localhost:3001`

Vite proxies `/api` and `/ws` requests to Express automatically.

### 4. Production build

```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build locally
```

For production, start the Express server (`node server/index.js`) and serve `dist/` via a static file host or the same Express instance.

---

## Project Structure

```
project-daedalus/
├── public/
│   └── cesium/              # Cesium static assets (auto-copied by postinstall)
├── server/
│   ├── index.js             # Express entry point + WebSocket server
│   ├── cacheManager.js      # File-based cache with tiered TTLs
│   ├── lib/
│   │   ├── ll2Client.js     # Axios wrapper for Launch Library 2
│   │   ├── spaceTrackClient.js
│   │   └── spaceTrackRateLimiter.js
│   ├── routes/
│   │   ├── launches.js      # /api/launches/upcoming
│   │   ├── history.js       # /api/launches/history + /chart + /compare + /stats
│   │   ├── orbit.js         # /api/orbit/:launchId
│   │   ├── tle.js           # /api/tle/*
│   │   ├── failures.js      # /api/failures/*
│   │   └── vehicles.js      # /api/launches/vehicle-config
│   ├── cache-data/          # Runtime JSON cache (git-ignored)
│   └── logs/                # Winston logs (git-ignored)
├── src/
│   ├── components/
│   │   ├── dashboard/       # LaunchStrip, NextLaunchCard, VehicleSpecs, LaunchSiteMap, …
│   │   ├── history/         # LaunchHistoryTable, SuccessRateChart, PayloadScatterPlot, …
│   │   ├── orbit/           # OrbitViewer, OrbitLoadingFallback
│   │   ├── calculator/      # Tab components, FormulaCard, MultiStageSimulator, …
│   │   ├── failures/        # FailureSearchTable, FailureTaxonomyChart, …
│   │   └── shared/          # NavBar, BudgetPill
│   ├── hooks/
│   │   ├── useBudget.js     # Polls /api/status for API budget info
│   │   └── useLaunchSocket.js
│   ├── lib/
│   │   ├── orbitMath.js     # Pure Keplerian propagator (no Cesium dependency)
│   │   ├── rocketFormulas.js
│   │   └── formulaConfig.js
│   ├── pages/               # Dashboard, History, Calculator, FailureDatabase, OrbitPage
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── .env.example
├── .gitignore
├── package.json
├── tailwind.config.js
└── vite.config.js
```

---

## API Reference

All endpoints are served at `http://localhost:3001` and proxied from the Vite dev server.

### Launches

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/launches/upcoming` | Next 10 upcoming launches (detailed mode). Cached 5 min / stale 30 min. |
| `GET` | `/api/launches/history` | Paginated past launches. Params: `page`, `limit` (max 100), `agency`, `rocket`, `orbit`, `outcome`, `date_from`, `date_to`, `sort`, `sort_desc`. Cached 24 hr. |
| `GET` | `/api/launches/history/chart` | **All** past launches for chart rendering (no pagination — fetches every page in parallel batches of 5). Cached 24 hr. |
| `GET` | `/api/launches/compare` | Fetch up to 5 launch records by ID. Param: `ids` (comma-separated). |
| `GET` | `/api/launches/stats` | Aggregated year-by-year success stats for a rocket family. Param: `rocket`. |
| `GET` | `/api/launches/vehicle-config` | Rocket configuration details. Param: `search`. |

### Orbit & TLE

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/orbit/:launchId` | Orbital elements + TLE + launch site for a single launch. Cached 7 days. |
| `GET` | `/api/tle/:noradId` | Current TLE for a NORAD catalogue ID. |
| `GET` | `/api/tle/:noradId/position` | Current ECI/geodetic position from the TLE. |
| `GET` | `/api/tle/:noradId/ground-track` | Ground track points over N orbits. |
| `GET` | `/api/tle/lookup/:launchId` | Resolve a LL2 launch ID to a NORAD ID. |
| `GET` | `/api/tle/satcat/:noradId` | Space-Track satellite catalogue entry. |
| `GET` | `/api/tle/status` | Space-Track authentication status. |

### Failures

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/failures/all` | All historical launch failures with failure reasons. |
| `GET` | `/api/failures/stats` | Aggregated failure taxonomy stats. |
| `GET` | `/api/failures/:id` | Single failure record. |

### System

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/status` | API budget remaining, cache stats, server timestamp. |
| `WS` | `/ws` | WebSocket — server pushes `LAUNCHES_UPDATE` events every 60 s. |

---

## Caching

The server uses a file-based JSON cache (`server/cache-data/`) to minimise LL2 API consumption.

| Data type | Fresh TTL | Stale TTL |
|---|---|---|
| Upcoming launches | 5 minutes | 30 minutes |
| History pages | 24 hours | 48 hours |
| Chart data (all history) | 24 hours | 48 hours |
| Aggregate stats | 24 hours | 48 hours |
| Individual launch detail | 7 days | 14 days |

Stale-while-revalidate: a stale cache entry is served immediately while a background refresh runs, keeping the UI fast even when data is slightly out of date.

The current API budget is visible in the top-right **budget pill** on every page and at `GET /api/status`.

---

## 3D Orbit Viewer

The orbit viewer (`/orbit/:launchId`) uses **CesiumJS** for the globe and **satellite.js** for real-time SGP4/SDP4 propagation.

What it renders:
- **White polyline** — the orbital ellipse (360 points from Keplerian elements)
- **Blue dashed polyline** — ground track over 3 full orbits (TLE-based if available, Keplerian fallback)
- **Semi-transparent disc** — the orbital plane
- **Red point** — launch site
- **Lime point** — ascending node (RAAN crossing)
- **Yellow point** — live satellite position, updated every 5 seconds

**Imagery**: defaults to Cesium Ion World Imagery (requires `VITE_CESIUM_TOKEN`). Automatically falls back to the bundled NaturalEarthII tileset if the token is absent or invalid — the globe always renders.

**Controls** (bottom overlay): Reset Camera · Follow Satellite · Export PNG

---

## Delta-v Calculator

Five tabs covering the main domains of rocket engineering:

| Tab | Formulas |
|---|---|
| **Propulsion** | Tsiolkovsky rocket equation, thrust, thrust-to-weight ratio, specific impulse, exhaust velocity |
| **Orbital Mechanics** | Hohmann transfer Δv, orbital velocity, escape velocity, orbital period, sphere of influence |
| **Trajectory** | Gravity turn, dynamic pressure (max-Q), range equation, flight path angle |
| **Reentry** | Ballistic coefficient, peak heating rate, deceleration load, stagnation temperature |
| **Simulator** | Multi-stage Δv simulation with known stage presets (Falcon 9, Falcon Heavy, Electron, Vulcan, SLS, …) |

Supports **load from database** (pulls vehicle specs from the live LL2 API) and **PDF export** of results.

---

## Rate Limits

| Access level | Requests/hour | Notes |
|---|---|---|
| Anonymous (no key) | 15 | Set via LL2 default |
| Authenticated (`VITE_LL2_API_KEY`) | 300 | [Register at SpaceDevs](https://thespacedevs.com/llapi) |

A rate-limit warning banner appears in the History module when the 429 threshold is hit. The cache absorbs most repeat requests — heavy usage of the chart endpoint (which fetches all history pages at once) benefits most from an authenticated token.

---

## Contributing

1. Fork the repo and create a feature branch
2. Follow the existing code style (no comments unless the *why* is non-obvious, no trailing summaries)
3. Open a PR against `main`

---

## License

MIT
