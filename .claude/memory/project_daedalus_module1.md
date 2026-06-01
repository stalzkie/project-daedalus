---
name: project-daedalus-module1
description: Architecture and status of Project Daedalus Module 1 — Live Launch Dashboard
metadata:
  type: project
---

Project Daedalus Module 1 — Live Launch Dashboard is fully built and installable.

**Tech stack:** React 18, Vite 5, Tailwind CSS 3, Axios, @tanstack/react-query v5, Leaflet + react-leaflet, Recharts, Express, ws (WebSocket)

**To start:** `npm run dev` — runs Express on :3001 + Vite on :5173 concurrently.

**Key decision:** LL2 SpaceDevs API is NOT used. Backend returns mock data matching LL2 v2.2.0 schema exactly. This is intentional per user instruction ("We're not gonna use the LL2 API from spacedevs").

**Why:** Mock data lets the dashboard run fully offline and makes the schema contract explicit.

**How to apply:** If the user wants to swap in the real LL2 API, the change is isolated to `server/routes/launches.js` — replace `buildMockLaunches()` with an axios call to `https://ll.thespacedevs.com/2.2.0/launch/upcoming/` with the `VITE_LL2_API_KEY` env var.

**Route:** `"/"` → `src/pages/Dashboard.jsx`

**Components:** All in `src/components/dashboard/`:
- `LaunchStrip.jsx` — horizontal scrolling strip, T-minus countdown, status badge, agency flag
- `NextLaunchCard.jsx` — full-width mission card with live countdown
- `VehicleSpecs.jsx` — engine count, thrust_kN, stages, payload specs, bar charts
- `LaunchSiteMap.jsx` — Leaflet map centered on pad lat/lng, marker + popup (ICAO)
- `StatusLog.jsx` — terminal-style auto-scrolling log with live telemetry ticks
- `WeatherWidget.jsx` — Open-Meteo forecast, WMO weather codes, GO/NO-GO verdict
- `DataSourceTag.jsx` — reusable ℹ tooltip showing source + fetchedAt for every panel

**WebSocket:** `server/index.js` broadcasts every 60s via `/ws`. Client (`src/hooks/useLaunchSocket.js`) tries WS first, falls back to React Query's `refetchInterval: 60000`.
