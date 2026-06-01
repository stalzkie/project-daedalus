/**
 * rocketFormulas.js
 * Pure formula engine — all inputs/outputs in SI units.
 * Every function returns a result object plus a `working` array of calculation steps.
 */

// ─── Physical constants ────────────────────────────────────────────────────
const G       = 6.674e-11   // gravitational constant [m³ kg⁻¹ s⁻²]
const M_EARTH = 5.972e24    // Earth mass [kg]
const R_EARTH = 6.371e6     // Earth mean radius [m]
const g0      = 9.80665     // standard gravity [m/s²]
const GM      = G * M_EARTH // [m³/s²]

// ─── Atmosphere model (ISA simplified) ────────────────────────────────────
function atmosphericDensity(h) {
  if (h <= 0)       return 1.225
  if (h <= 11_000)  { const T = 288.15 - 0.0065 * h; return 1.225 * (T / 288.15) ** 4.2561 }
  if (h <= 25_000)  return 0.3639 * Math.exp(-0.0001577 * (h - 11_000))
  if (h <= 80_000)  return 0.04008 * Math.exp(-0.0001341 * (h - 25_000))
  return 0
}
export { atmosphericDensity }

function step(description, formula, value, unit) {
  return { description, formula, value, unit }
}

// ─── Formula functions ─────────────────────────────────────────────────────

/**
 * Tsiolkovsky rocket equation — ideal Δv for a propulsive burn.
 * @param {number} isp_s         Specific impulse [s]
 * @param {number} m0_kg         Initial (wet) mass [kg]
 * @param {number} mf_kg         Final (dry) mass [kg]
 * @returns {{ deltaV_ms: number, exhaustVelocity_ms: number, massRatio: number, working: object[] }}
 */
export function tsiolkovskyDeltaV(isp_s, m0_kg, mf_kg) {
  const ve = isp_s * g0
  const mr = m0_kg / mf_kg
  const deltaV = ve * Math.log(mr)
  return {
    deltaV_ms: deltaV,
    exhaustVelocity_ms: ve,
    massRatio: mr,
    working: [
      step('Effective exhaust velocity',    've = Isp × g₀',             ve,     'm/s'),
      step('Mass ratio',                    'R = m₀ / mf',               mr,     '—'),
      step('Natural log of mass ratio',     'ln(R) = ln(m₀/mf)',         Math.log(mr), '—'),
      step('Delta-v (Tsiolkovsky)',         'Δv = ve × ln(R)',            deltaV, 'm/s'),
    ],
  }
}

/**
 * Thrust produced by expelling propellant.
 * @param {number} massFlowRate_kgs  Propellant mass flow rate [kg/s]
 * @param {number} isp_s             Specific impulse [s]
 * @returns {{ thrust_N: number, exhaustVelocity_ms: number, working: object[] }}
 */
export function thrust(massFlowRate_kgs, isp_s) {
  const ve = isp_s * g0
  const F  = massFlowRate_kgs * ve
  return {
    thrust_N: F,
    exhaustVelocity_ms: ve,
    working: [
      step('Effective exhaust velocity',  've = Isp × g₀',    ve,  'm/s'),
      step('Thrust force',                'F = ṁ × ve',       F,   'N'),
    ],
  }
}

/**
 * Thrust-to-weight ratio at liftoff.
 * @param {number} thrust_N      Engine thrust [N]
 * @param {number} totalMass_kg  Total vehicle mass at liftoff [kg]
 * @returns {{ twr: number, isViable: boolean, weight_N: number, working: object[] }}
 */
export function twrAtLiftoff(thrust_N, totalMass_kg) {
  const W   = totalMass_kg * g0
  const twr = thrust_N / W
  return {
    twr,
    isViable: twr > 1.0,
    weight_N: W,
    working: [
      step('Vehicle weight',        'W = m × g₀',       W,   'N'),
      step('Thrust-to-weight ratio','TWR = F / W',       twr, '—'),
      step('Liftoff viable?',       'TWR > 1.0',         twr > 1 ? 1 : 0, twr > 1 ? 'YES' : 'NO'),
    ],
  }
}

/**
 * Circular orbital velocity at a given altitude above Earth.
 * @param {number} altitude_m  Orbital altitude above Earth surface [m]
 * @returns {{ velocity_ms: number, altitude_km: number, radius_m: number, working: object[] }}
 */
export function orbitalVelocity(altitude_m) {
  const r = R_EARTH + altitude_m
  const v = Math.sqrt(GM / r)
  return {
    velocity_ms: v,
    altitude_km: altitude_m / 1000,
    radius_m: r,
    working: [
      step('Orbital radius',         'r = R⊕ + h',              r,  'm'),
      step('Gravitational parameter','GM = 3.986 × 10¹⁴ m³/s²', GM, 'm³/s²'),
      step('Circular orbital speed', 'v = √(GM/r)',              v,  'm/s'),
    ],
  }
}

/**
 * Orbital period for a circular or elliptical orbit.
 * @param {number} semiMajorAxis_m  Semi-major axis (= radius for circular orbit) [m]
 * @returns {{ period_s: number, period_min: number, period_hr: number, working: object[] }}
 */
export function orbitalPeriod(semiMajorAxis_m) {
  const T     = 2 * Math.PI * Math.sqrt(semiMajorAxis_m ** 3 / GM)
  const T_min = T / 60
  const T_hr  = T / 3600
  return {
    period_s:   T,
    period_min: T_min,
    period_hr:  T_hr,
    working: [
      step('Semi-major axis',   'a = input',                          semiMajorAxis_m, 'm'),
      step('a³',                'a³',                                 semiMajorAxis_m ** 3, 'm³'),
      step('a³/GM',             'a³ / GM',                            semiMajorAxis_m ** 3 / GM, 's²'),
      step('Orbital period',    'T = 2π × √(a³/GM)',                 T,     's'),
      step('Period in minutes', 'T_min = T / 60',                    T_min, 'min'),
    ],
  }
}

/**
 * Escape velocity from a given altitude above Earth.
 * @param {number} altitude_m  Altitude above Earth surface [m]
 * @returns {{ escVelocity_ms: number, working: object[] }}
 */
export function escapeVelocity(altitude_m) {
  const r    = R_EARTH + altitude_m
  const vEsc = Math.sqrt(2 * GM / r)
  const vOrb = Math.sqrt(GM / r)
  return {
    escVelocity_ms: vEsc,
    orbitalVelocity_ms: vOrb,
    ratio: vEsc / vOrb,
    working: [
      step('Orbital radius',        'r = R⊕ + h',           r,              'm'),
      step('2GM',                   '2GM',                   2 * GM,         'm³/s²'),
      step('Escape velocity',       'v_esc = √(2GM/r)',      vEsc,           'm/s'),
      step('Compare to v_orbital',  'v_esc = √2 × v_orbital',vOrb * Math.SQRT2, 'm/s'),
    ],
  }
}

/**
 * Hohmann transfer orbit between two circular orbits.
 * @param {number} r1_m   Initial orbit radius from Earth centre [m]
 * @param {number} r2_m   Target orbit radius from Earth centre [m]
 * @param {number} mass_kg  Spacecraft wet mass [kg]
 * @param {number} isp_s    Engine Isp for propellant mass calculation [s]
 * @returns {{ dv1_ms, dv2_ms, totalDv_ms, transferTime_s, propellantMass_kg, working }}
 */
export function hohmannTransfer(r1_m, r2_m, mass_kg, isp_s) {
  const v1   = Math.sqrt(GM / r1_m)
  const v2   = Math.sqrt(GM / r2_m)
  const at   = (r1_m + r2_m) / 2
  const vt1  = Math.sqrt(GM * (2 / r1_m - 1 / at))
  const vt2  = Math.sqrt(GM * (2 / r2_m - 1 / at))
  const dv1  = Math.abs(vt1 - v1)
  const dv2  = Math.abs(v2 - vt2)
  const dv   = dv1 + dv2
  const tTransfer = Math.PI * Math.sqrt(at ** 3 / GM)
  const mProp     = mass_kg * (1 - Math.exp(-dv / (isp_s * g0)))

  return {
    dv1_ms: dv1, dv2_ms: dv2, totalDv_ms: dv,
    transferTime_s: tTransfer, transferTime_min: tTransfer / 60,
    propellantMass_kg: mProp,
    working: [
      step('Initial orbit speed',      'v₁ = √(GM/r₁)',                    v1,       'm/s'),
      step('Final orbit speed',        'v₂ = √(GM/r₂)',                    v2,       'm/s'),
      step('Transfer semi-major axis', 'aₜ = (r₁ + r₂) / 2',              at,       'm'),
      step('Transfer speed at r₁',     'vₜ₁ = √(GM×(2/r₁ − 1/aₜ))',      vt1,      'm/s'),
      step('Transfer speed at r₂',     'vₜ₂ = √(GM×(2/r₂ − 1/aₜ))',      vt2,      'm/s'),
      step('First burn Δv',            'Δv₁ = vₜ₁ − v₁',                  dv1,      'm/s'),
      step('Second burn Δv',           'Δv₂ = v₂ − vₜ₂',                  dv2,      'm/s'),
      step('Total Δv',                 'Δv = Δv₁ + Δv₂',                  dv,       'm/s'),
      step('Transfer time',            'tₜ = π × √(aₜ³/GM)',              tTransfer,'s'),
      step('Propellant required',      'mₚ = m×(1 − e^(−Δv/Isp×g₀))',    mProp,    'kg'),
    ],
  }
}

/**
 * Dynamic pressure (Max-Q) at a given altitude and velocity.
 * @param {number} altitude_m   Altitude [m]
 * @param {number} velocity_ms  Airspeed [m/s]
 * @returns {{ q_Pa, density_kgm3, working }}
 */
export function dynamicPressure(altitude_m, velocity_ms) {
  const rho = atmosphericDensity(altitude_m)
  const q   = 0.5 * rho * velocity_ms ** 2
  return {
    q_Pa: q,
    density_kgm3: rho,
    working: [
      step('Air density at altitude', 'ρ(h) = ISA model',          rho,           'kg/m³'),
      step('Dynamic pressure',        'q = ½ρv²',                  q,             'Pa'),
      step('Equivalent to',           'q in kPa',                  q / 1000,      'kPa'),
    ],
  }
}

/**
 * Ballistic coefficient for reentry analysis.
 * @param {number} mass_kg          Vehicle/capsule mass [kg]
 * @param {number} Cd               Drag coefficient (dimensionless)
 * @param {number} referenceArea_m2 Reference cross-sectional area [m²]
 * @returns {{ beta_kgm2, working }}
 */
export function ballisticCoefficient(mass_kg, Cd, referenceArea_m2) {
  const beta = mass_kg / (Cd * referenceArea_m2)
  return {
    beta_kgm2: beta,
    working: [
      step('Ballistic coefficient', 'β = m / (Cd × A)',   beta, 'kg/m²'),
      step('Higher β →',            'deeper atmosphere penetration, higher peak heating', beta, 'kg/m²'),
    ],
  }
}

/**
 * Peak reentry deceleration (simplified).
 * @param {number} entryVelocity_ms  Atmospheric entry speed [m/s]
 * @param {number} entryAngle_deg    Flight path angle below horizontal [°] (positive)
 * @param {number} beta_kgm2         Ballistic coefficient [kg/m²]
 * @returns {{ peakDecel_ms2, peakDecel_g, peakAlt_m, working }}
 */
export function reentryDeceleration(entryVelocity_ms, entryAngle_deg, beta_kgm2) {
  const H     = 8_500              // atmospheric scale height [m]
  const gamma = entryAngle_deg * Math.PI / 180
  const rho0  = 1.225
  const peakAlt = H * Math.log(rho0 * entryVelocity_ms ** 2 / (2 * beta_kgm2 * g0 * Math.sin(gamma)))
  const peakDecel = entryVelocity_ms ** 2 / (2 * H * Math.exp(1) * Math.sin(gamma))
  const peakG = peakDecel / g0
  return {
    peakDecel_ms2: peakDecel,
    peakDecel_g:   peakG,
    peakAlt_m:     Math.max(0, peakAlt),
    working: [
      step('Scale height',               'H = 8500 m (Earth)',                H,         'm'),
      step('Entry angle (radians)',       'γ = θ × π/180',                    gamma,     'rad'),
      step('Peak deceleration altitude', 'h_peak = H×ln(ρ₀v²/(2βg sinγ))',   peakAlt,   'm'),
      step('Peak deceleration',          'a_max = v²/(2He sinγ)',             peakDecel, 'm/s²'),
      step('Peak deceleration in g',     'a_max / g₀',                       peakG,     'g'),
    ],
  }
}

/**
 * Multi-stage rocket simulation using Tsiolkovsky for each stage.
 * @param {{ dryMass_kg, propMass_kg, isp_vac_s, isp_sl_s, thrust_N }[]} stages
 * @returns {{ stageDeltaVs, totalDeltaV_ms, massAtEachStage, twrPerStage, canReachLEO, working }}
 */
export function multiStageSimulator(stages) {
  if (!stages || stages.length === 0) return { stageDeltaVs: [], totalDeltaV_ms: 0, massAtEachStage: [], working: [] }

  let massRemaining = stages.reduce((s, st) => s + st.dryMass_kg + st.propMass_kg, 0)
  const stageDeltaVs   = []
  const massAtEachStage = [massRemaining]
  const twrPerStage    = []
  const working        = []

  working.push(step('Total launch mass', 'Σ(dry + propellant)', massRemaining, 'kg'))

  stages.forEach((stage, i) => {
    const m0 = massRemaining
    const mf = massRemaining - stage.propMass_kg
    if (mf <= 0) { stageDeltaVs.push(0); massAtEachStage.push(massRemaining); twrPerStage.push(0); return }

    const dv  = stage.isp_vac_s * g0 * Math.log(m0 / mf)
    const twr = stage.thrust_N / (m0 * g0)
    stageDeltaVs.push(dv)
    twrPerStage.push(twr)

    working.push(step(`Stage ${i + 1} — initial mass`, `m₀ = ${m0.toFixed(0)} kg`, m0, 'kg'))
    working.push(step(`Stage ${i + 1} — final mass`,   `mf = ${mf.toFixed(0)} kg`, mf, 'kg'))
    working.push(step(`Stage ${i + 1} — Δv`,           `Δv = Isp × g₀ × ln(${m0.toFixed(0)}/${mf.toFixed(0)})`, dv, 'm/s'))
    working.push(step(`Stage ${i + 1} — TWR`,          `TWR = ${stage.thrust_N.toLocaleString()} N / (${m0.toFixed(0)} × g₀)`, twr, '—'))

    massRemaining = mf - stage.dryMass_kg
    massAtEachStage.push(massRemaining)
  })

  const total = stageDeltaVs.reduce((s, v) => s + v, 0)
  working.push(step('Total Δv', 'Σ stage Δvs', total, 'm/s'))
  working.push(step('LEO threshold', '≥ 9 400 m/s required', 9400, 'm/s'))

  return {
    stageDeltaVs,
    totalDeltaV_ms: total,
    massAtEachStage,
    twrPerStage,
    canReachLEO: total >= 9400,
    working,
  }
}

/**
 * Ascent trajectory simulation using forward Euler integration (1 s timestep).
 * Simplified vertical ascent with ISA atmospheric model and drag.
 * @param {{ dryMass_kg, propMass_kg, isp_vac_s, isp_sl_s, thrust_N }[]} stages
 * @param {{ Cd?, referenceArea_m2?, fairingMass_kg?, fairingSepAlt_m?, dt? }} options
 * @returns {{ data: object[], events: object[], maxQ_Pa: number, maxQAlt_km: number, mecoTime_s: number }}
 */
export function simulateAscent(stages, options = {}) {
  const {
    Cd              = 0.3,
    referenceArea_m2 = 12,
    fairingMass_kg   = 1_900,
    fairingSepAlt_m  = 110_000,
    dt               = 1,
    maxTime_s        = 700,
  } = options

  if (!stages || stages.length === 0) return { data: [], events: [], maxQ_Pa: 0, maxQAlt_km: 0, mecoTime_s: 0 }

  const stageState = stages.map(s => ({ ...s, propLeft: s.propMass_kg, done: false }))
  let m            = stageState.reduce((s, st) => s + st.dryMass_kg + st.propMass_kg, 0) + fairingMass_kg
  let h = 0, v = 0, t = 0
  let currentIdx      = 0
  let fairingDropped  = false
  let maxQ = 0, maxQTime = 0, maxQAlt = 0
  let mecoTime        = 0

  const data   = []
  const events = []

  while (t < maxTime_s && h >= 0) {
    const stage = stageState[currentIdx]
    if (!stage) { mecoTime = t; break }

    const rho  = atmosphericDensity(h)
    const blend = Math.min(1, h / 25_000)
    const isp   = stage.isp_sl_s + blend * (stage.isp_vac_s - stage.isp_sl_s)

    // Consume propellant
    const mdot = stage.thrust_N / (isp * g0)
    const dm   = Math.min(mdot * dt, stage.propLeft)
    stage.propLeft -= dm
    m -= dm

    const F    = stage.propLeft > 0 ? stage.thrust_N : 0
    const gEff = g0 * (R_EARTH / (R_EARTH + h)) ** 2
    const drag = 0.5 * Cd * referenceArea_m2 * rho * v * Math.abs(v)
    const q    = 0.5 * rho * v * v

    if (q > maxQ) { maxQ = q; maxQTime = t; maxQAlt = h }

    // Fairing jettison
    if (!fairingDropped && h >= fairingSepAlt_m) {
      m -= fairingMass_kg
      fairingDropped = true
      events.push({ t, type: 'fairing_sep', h, label: 'Fairing Sep' })
    }

    const a = (F - drag) / m - gEff

    // Only record every 2nd point to keep data lean
    if (t % 2 === 0) {
      data.push({
        t:   Math.round(t),
        h:   parseFloat((h / 1000).toFixed(2)),   // km
        v:   Math.round(v),
        a:   parseFloat(a.toFixed(2)),
        q:   Math.round(q),
        m:   Math.round(m),
      })
    }

    // Stage separation
    if (stage.propLeft <= 0 && !stage.done) {
      stage.done = true
      m -= stage.dryMass_kg
      events.push({ t, type: 'staging', h, label: `Stage ${currentIdx + 1} Sep` })
      currentIdx++
    }

    v += a * dt
    h += v * dt
    t += dt

    if (h > 2_200_000) break // sanity cap at 2 200 km
  }

  if (mecoTime === 0) mecoTime = t

  // Insert Max-Q event
  events.push({ t: maxQTime, type: 'max_q', h: maxQAlt, label: 'Max-Q' })
  events.sort((a, b) => a.t - b.t)

  return { data, events, maxQ_Pa: maxQ, maxQAlt_km: maxQAlt / 1000, mecoTime_s: mecoTime }
}
