/**
 * Data-driven formula registry.
 * Shared by FormulaCard, FormulaReferencePanel, and ExportReport.
 */
import {
  tsiolkovskyDeltaV, thrust, twrAtLiftoff,
  orbitalVelocity, orbitalPeriod, escapeVelocity,
  hohmannTransfer, dynamicPressure,
  ballisticCoefficient, reentryDeceleration,
} from './rocketFormulas.js'

// Must be declared before FORMULA_CONFIGS uses it
const R_EARTH = 6.371e6

export const FORMULA_CONFIGS = [
  // ── Propulsion ─────────────────────────────────────────────────────────
  {
    id: 'tsiolkovsky', tab: 'propulsion',
    name: 'Tsiolkovsky Rocket Equation',
    description: 'Ideal velocity budget for a propulsive burn.',
    latex: '\\Delta v = I_{sp} \\cdot g_0 \\cdot \\ln\\!\\left(\\dfrac{m_0}{m_f}\\right)',
    inputs: [
      { key: 'isp_s',  label: 'Specific Impulse', unit: 's',  default: 350,    min: 50,    max: 10000 },
      { key: 'm0_kg',  label: 'Initial (wet) mass', unit: 'kg', default: 100000, min: 1,   max: 1e9  },
      { key: 'mf_kg',  label: 'Final (dry) mass',  unit: 'kg', default: 10000,  min: 1,   max: 1e9  },
    ],
    fn: (isp_s, m0_kg, mf_kg) => tsiolkovskyDeltaV(isp_s, m0_kg, mf_kg),
    resultKey: 'deltaV_ms', resultLabel: 'Δv', resultUnit: 'm/s',
    highlight: (v) => v >= 9400 ? 'green' : v >= 7800 ? 'yellow' : 'neutral',
  },
  {
    id: 'thrust', tab: 'propulsion',
    name: 'Thrust Equation',
    description: 'Force produced by expelling propellant.',
    latex: 'F = \\dot{m} \\cdot I_{sp} \\cdot g_0',
    inputs: [
      { key: 'massFlowRate_kgs', label: 'Mass Flow Rate', unit: 'kg/s', default: 270,  min: 0.001, max: 100000 },
      { key: 'isp_s',           label: 'Specific Impulse', unit: 's',   default: 350,  min: 50,    max: 10000  },
    ],
    fn: (massFlowRate_kgs, isp_s) => thrust(massFlowRate_kgs, isp_s),
    resultKey: 'thrust_N', resultLabel: 'F', resultUnit: 'N',
  },
  {
    id: 'twr', tab: 'propulsion',
    name: 'Thrust-to-Weight Ratio',
    description: 'Ratio of engine thrust to vehicle weight. Must exceed 1 for liftoff.',
    latex: 'TWR = \\dfrac{F}{m \\cdot g_0}',
    inputs: [
      { key: 'thrust_N',     label: 'Engine Thrust',  unit: 'N',  default: 7607000, min: 1,    max: 1e9 },
      { key: 'totalMass_kg', label: 'Total Mass',     unit: 'kg', default: 549054,  min: 1,    max: 1e9 },
    ],
    fn: (thrust_N, totalMass_kg) => twrAtLiftoff(thrust_N, totalMass_kg),
    resultKey: 'twr', resultLabel: 'TWR', resultUnit: '—',
    highlight: (v) => v > 1.5 ? 'green' : v > 1.0 ? 'yellow' : 'danger',
  },

  // ── Orbital Mechanics ──────────────────────────────────────────────────
  {
    id: 'orbital-velocity', tab: 'orbital',
    name: 'Circular Orbital Velocity',
    description: 'Speed required to maintain a circular orbit at a given altitude.',
    latex: 'v = \\sqrt{\\dfrac{GM_\\oplus}{R_\\oplus + h}}',
    inputs: [
      { key: 'altitude_m', label: 'Altitude', unit: 'm', default: 400000, min: 0, max: 4e7 },
    ],
    fn: (altitude_m) => orbitalVelocity(altitude_m),
    resultKey: 'velocity_ms', resultLabel: 'v', resultUnit: 'm/s',
  },
  {
    id: 'orbital-period', tab: 'orbital',
    name: 'Orbital Period',
    description: 'Time to complete one full orbit (Kepler\'s third law).',
    latex: 'T = 2\\pi\\sqrt{\\dfrac{a^3}{GM_\\oplus}}',
    inputs: [
      { key: 'semiMajorAxis_m', label: 'Semi-major Axis', unit: 'm', default: 6771000, min: R_EARTH, max: 1e10 },
    ],
    fn: (semiMajorAxis_m) => orbitalPeriod(semiMajorAxis_m),
    resultKey: 'period_s', resultLabel: 'T', resultUnit: 's',
  },
  {
    id: 'escape-velocity', tab: 'orbital',
    name: 'Escape Velocity',
    description: 'Minimum speed to escape Earth\'s gravitational field.',
    latex: 'v_{esc} = \\sqrt{\\dfrac{2\\,GM_\\oplus}{R_\\oplus + h}}',
    inputs: [
      { key: 'altitude_m', label: 'Altitude', unit: 'm', default: 0, min: 0, max: 4e7 },
    ],
    fn: (altitude_m) => escapeVelocity(altitude_m),
    resultKey: 'escVelocity_ms', resultLabel: 'v_esc', resultUnit: 'm/s',
  },
  {
    id: 'hohmann', tab: 'orbital',
    name: 'Hohmann Transfer',
    description: 'Minimum-energy transfer between two circular orbits.',
    latex: '\\Delta v_1 = v_1\\!\\left(\\!\\sqrt{\\dfrac{2r_2}{r_1+r_2}}-1\\right)',
    inputs: [
      { key: 'r1_m',    label: 'Initial orbit radius', unit: 'm',  default: 6771000, min: 6.4e6, max: 4e8 },
      { key: 'r2_m',    label: 'Target orbit radius',  unit: 'm',  default: 42164000, min: 6.4e6, max: 4e8 },
      { key: 'mass_kg', label: 'Spacecraft mass',      unit: 'kg', default: 5000,    min: 1,     max: 1e7 },
      { key: 'isp_s',   label: 'Engine Isp',           unit: 's',  default: 320,     min: 50,    max: 5000 },
    ],
    fn: (r1_m, r2_m, mass_kg, isp_s) => hohmannTransfer(r1_m, r2_m, mass_kg, isp_s),
    resultKey: 'totalDv_ms', resultLabel: 'Δv_total', resultUnit: 'm/s',
  },

  // ── Trajectory ─────────────────────────────────────────────────────────
  {
    id: 'dynamic-pressure', tab: 'trajectory',
    name: 'Dynamic Pressure (Max-Q)',
    description: 'Aerodynamic pressure on the vehicle — peak occurs at Max-Q.',
    latex: 'q = \\tfrac{1}{2}\\,\\rho\\,v^2',
    inputs: [
      { key: 'altitude_m',  label: 'Altitude',  unit: 'm',   default: 12000,  min: 0,    max: 80000 },
      { key: 'velocity_ms', label: 'Velocity',  unit: 'm/s', default: 450,    min: 0,    max: 10000 },
    ],
    fn: (altitude_m, velocity_ms) => dynamicPressure(altitude_m, velocity_ms),
    resultKey: 'q_Pa', resultLabel: 'q', resultUnit: 'Pa',
  },

  // ── Reentry ─────────────────────────────────────────────────────────────
  {
    id: 'ballistic-coeff', tab: 'reentry',
    name: 'Ballistic Coefficient',
    description: 'Governs how deep into the atmosphere a vehicle penetrates before decelerating.',
    latex: '\\beta = \\dfrac{m}{C_D \\cdot A}',
    inputs: [
      { key: 'mass_kg',          label: 'Vehicle Mass',     unit: 'kg',  default: 8000,  min: 1,    max: 1e6 },
      { key: 'Cd',               label: 'Drag Coefficient', unit: '—',   default: 1.2,   min: 0.01, max: 5   },
      { key: 'referenceArea_m2', label: 'Reference Area',   unit: 'm²',  default: 10.5,  min: 0.01, max: 200 },
    ],
    fn: (mass_kg, Cd, referenceArea_m2) => ballisticCoefficient(mass_kg, Cd, referenceArea_m2),
    resultKey: 'beta_kgm2', resultLabel: 'β', resultUnit: 'kg/m²',
  },
  {
    id: 'reentry-decel', tab: 'reentry',
    name: 'Peak Reentry Deceleration',
    description: 'Maximum deceleration experienced during atmospheric entry.',
    latex: 'a_{max} = \\dfrac{v_e^2}{2\\,H\\,e\\,\\sin\\gamma}',
    inputs: [
      { key: 'entryVelocity_ms', label: 'Entry Velocity',   unit: 'm/s', default: 7800,  min: 1000, max: 15000 },
      { key: 'entryAngle_deg',   label: 'Entry Angle',      unit: '°',   default: 6,     min: 1,    max: 90    },
      { key: 'beta_kgm2',        label: 'Ballistic Coeff.', unit: 'kg/m²', default: 700, min: 1,    max: 10000 },
    ],
    fn: (entryVelocity_ms, entryAngle_deg, beta_kgm2) => reentryDeceleration(entryVelocity_ms, entryAngle_deg, beta_kgm2),
    resultKey: 'peakDecel_g', resultLabel: 'Peak decel', resultUnit: 'g',
    highlight: (v) => v < 6 ? 'green' : v < 12 ? 'yellow' : 'danger',
  },
]

export const FORMULA_BY_ID  = Object.fromEntries(FORMULA_CONFIGS.map(f => [f.id, f]))
export const FORMULAS_BY_TAB = FORMULA_CONFIGS.reduce((acc, f) => {
  if (!acc[f.tab]) acc[f.tab] = []
  acc[f.tab].push(f)
  return acc
}, {})
