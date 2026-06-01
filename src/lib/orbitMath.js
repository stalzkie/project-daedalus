/**
 * Orbital mechanics library — no Cesium dependency.
 * All positions in km unless noted; angles in radians unless noted.
 */
import * as satellite from 'satellite.js'

const GM_KM3_S2     = 398600.4418   // Earth gravitational parameter (km³/s²)
const EARTH_R_KM    = 6371.0        // mean Earth radius (km)
const WGS84_A       = 6378.137      // WGS-84 semi-major axis (km)
const WGS84_F       = 1 / 298.257223563
const WGS84_E2      = 2 * WGS84_F - WGS84_F * WGS84_F

// Typical elements by orbit abbreviation — used when LL2 doesn't carry precise params
const ORBIT_DEFAULTS = {
  LEO:   { apogee_km: 400,    perigee_km: 400,   inclination_deg: 51.6 },
  VLEO:  { apogee_km: 340,    perigee_km: 330,   inclination_deg: 53   },
  SSO:   { apogee_km: 550,    perigee_km: 540,   inclination_deg: 97.7 },
  ISS:   { apogee_km: 420,    perigee_km: 408,   inclination_deg: 51.6 },
  MEO:   { apogee_km: 20200,  perigee_km: 20100, inclination_deg: 55   },
  GTO:   { apogee_km: 35786,  perigee_km: 200,   inclination_deg: 27   },
  GEO:   { apogee_km: 35786,  perigee_km: 35786, inclination_deg: 0.1  },
  HEO:   { apogee_km: 39000,  perigee_km: 500,   inclination_deg: 63.4 },
  POLAR: { apogee_km: 600,    perigee_km: 590,   inclination_deg: 90   },
  TLI:   { apogee_km: 380000, perigee_km: 200,   inclination_deg: 28   },
  BEO:   { apogee_km: 600000, perigee_km: 200,   inclination_deg: 28   },
}

// ─── Kepler's equation solver ──────────────────────────────────────────────

function solveKepler(M, e, tol = 1e-10) {
  // Newton-Raphson: M = E - e·sin(E)
  let E = M
  for (let i = 0; i < 50; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E))
    E += dE
    if (Math.abs(dE) < tol) break
  }
  return E
}

function eccentricToTrue(E, e) {
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2),
  )
}

// ─── Frame transforms ──────────────────────────────────────────────────────

function keplToEci(elements, trueAnomaly_rad) {
  const { sma_km: a, eccentricity: e, inclination_deg, raan_deg, arg_perigee_deg } = elements
  const i  = inclination_deg  * Math.PI / 180
  const Om = raan_deg          * Math.PI / 180
  const om = arg_perigee_deg   * Math.PI / 180
  const nu = trueAnomaly_rad

  const r = a * (1 - e * e) / (1 + e * Math.cos(nu))
  const xP = r * Math.cos(nu)
  const yP = r * Math.sin(nu)

  const cosOm = Math.cos(Om), sinOm = Math.sin(Om)
  const cosI  = Math.cos(i),  sinI  = Math.sin(i)
  const cosom = Math.cos(om), sinom = Math.sin(om)

  return {
    x: (cosOm * cosom - sinOm * sinom * cosI) * xP + (-cosOm * sinom - sinOm * cosom * cosI) * yP,
    y: (sinOm * cosom + cosOm * sinom * cosI) * xP + (-sinOm * sinom + cosOm * cosom * cosI) * yP,
    z: (sinom * sinI)                          * xP + (cosom * sinI)                          * yP,
  }
}

function eciToEcef(eci, epoch_ms) {
  const gmst = satellite.gstime(new Date(epoch_ms))
  const c = Math.cos(gmst), s = Math.sin(gmst)
  return {
    x:  eci.x * c + eci.y * s,
    y: -eci.x * s + eci.y * c,
    z:  eci.z,
  }
}

function ecefToGeodetic(ecef) {
  const { x, y, z } = ecef
  const lng_rad = Math.atan2(y, x)
  let lat_rad   = Math.atan2(z, Math.sqrt(x * x + y * y))
  for (let i = 0; i < 5; i++) {
    const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(lat_rad) ** 2)
    lat_rad = Math.atan2(z + WGS84_E2 * N * Math.sin(lat_rad), Math.sqrt(x * x + y * y))
  }
  const N    = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(lat_rad) ** 2)
  const r_xy = Math.sqrt(x * x + y * y)
  const alt  = Math.abs(Math.cos(lat_rad)) > 1e-6
    ? r_xy / Math.cos(lat_rad) - N
    : Math.abs(z) / Math.sin(lat_rad) - N * (1 - WGS84_E2)
  return { lat_deg: lat_rad * 180 / Math.PI, lng_deg: lng_rad * 180 / Math.PI, alt_km: alt }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * T = 2π √(a³/GM)  → returns milliseconds
 */
export function compute_orbital_period_ms(sma_km) {
  return 2 * Math.PI * Math.sqrt(sma_km ** 3 / GM_KM3_S2) * 1000
}

/**
 * Map LL2 orbit fields + orbit-type abbrev to Keplerian elements.
 * Falls back to ORBIT_DEFAULTS when LL2 values are absent.
 */
export function ll2_orbit_to_elements(orbit, orbitAbbrev) {
  const def = ORBIT_DEFAULTS[orbitAbbrev] || ORBIT_DEFAULTS.LEO
  const apogee_km  = orbit?.apogee  ?? def.apogee_km
  const perigee_km = orbit?.perigee ?? def.perigee_km
  const ra = apogee_km  + EARTH_R_KM
  const rp = perigee_km + EARTH_R_KM
  const sma_km      = (ra + rp) / 2
  const eccentricity = (ra - rp) / (ra + rp)
  return {
    sma_km,
    eccentricity,
    inclination_deg:  orbit?.inclination ?? def.inclination_deg,
    raan_deg:         orbit?.raan         ?? 0,
    arg_perigee_deg:  orbit?.arg_of_perigee ?? 0,
    mean_anomaly_deg: 0,
    apogee_km,
    perigee_km,
  }
}

/**
 * Propagate single position from Keplerian elements at a given time.
 * Returns { lat_deg, lng_deg, alt_km, x_km, y_km, z_km }
 */
export function keplerian_to_cartesian(elements, timestamp_ms = Date.now()) {
  const { sma_km, eccentricity, mean_anomaly_deg } = elements
  const n   = 2 * Math.PI / (compute_orbital_period_ms(sma_km) / 1000)   // rad/s
  const dt  = (timestamp_ms - Date.now()) / 1000
  const M   = ((mean_anomaly_deg * Math.PI / 180 + n * dt) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
  const E   = solveKepler(M, eccentricity)
  const nu  = eccentricToTrue(E, eccentricity)
  const eci = keplToEci(elements, nu)
  const ecef = eciToEcef(eci, timestamp_ms)
  return { ...ecef, ...ecefToGeodetic(ecef) }
}

/**
 * 360-point orbital ellipse in ECEF (km) at epoch_ms.
 * Returns array of { x_km, y_km, z_km } — caller converts to Cesium.Cartesian3.
 */
export function build_orbital_ellipse_points(elements, epoch_ms = Date.now(), num_points = 360) {
  const pts = []
  for (let i = 0; i <= num_points; i++) {
    const nu   = (i / num_points) * 2 * Math.PI
    const eci  = keplToEci(elements, nu)
    const ecef = eciToEcef(eci, epoch_ms)
    pts.push(ecef)   // { x, y, z } in km
  }
  return pts
}

/**
 * Ground track using a satellite.js satrec (TLE-based, accurate).
 * Returns [{ lat, lng, alt_km, timestamp }]
 */
export function propagate_ground_track(satrec, start_ms, end_ms, step_ms = 60_000) {
  const track = []
  for (let t = start_ms; t <= end_ms; t += step_ms) {
    const date = new Date(t)
    const pv   = satellite.propagate(satrec, date)
    if (!pv?.position || isNaN(pv.position.x)) continue
    const gmst = satellite.gstime(date)
    const gd   = satellite.eciToGeodetic(pv.position, gmst)
    track.push({
      lat:    satellite.degreesLat(gd.latitude),
      lng:    satellite.degreesLong(gd.longitude),
      alt_km: gd.height,
      timestamp: t,
    })
  }
  return track
}

/**
 * Ground track from Keplerian elements (no TLE — approximate, perturb-free).
 */
export function propagate_ground_track_from_elements(elements, start_ms, end_ms, step_ms = 60_000) {
  const { sma_km, eccentricity, mean_anomaly_deg } = elements
  const n   = 2 * Math.PI / (compute_orbital_period_ms(sma_km) / 1000)
  const M0  = mean_anomaly_deg * Math.PI / 180
  const track = []
  for (let t = start_ms; t <= end_ms; t += step_ms) {
    const dt   = (t - start_ms) / 1000
    const M    = (M0 + n * dt) % (2 * Math.PI)
    const E    = solveKepler((M + 2 * Math.PI) % (2 * Math.PI), eccentricity)
    const nu   = eccentricToTrue(E, eccentricity)
    const eci  = keplToEci(elements, nu)
    const ecef = eciToEcef(eci, t)
    const geo  = ecefToGeodetic(ecef)
    if (!isNaN(geo.lat_deg)) track.push({ lat: geo.lat_deg, lng: geo.lng_deg, alt_km: geo.alt_km, timestamp: t })
  }
  return track
}
