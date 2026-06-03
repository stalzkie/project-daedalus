import { useEffect, useRef, useState, useCallback } from 'react'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import * as satellite from 'satellite.js'
import {
  ll2_orbit_to_elements,
  build_orbital_ellipse_points,
  propagate_ground_track,
  propagate_ground_track_from_elements,
  compute_orbital_period_ms,
} from '../../lib/orbitMath'

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN || ''

// ─── Satellite billboard icon (SVG → data URI) ────────────────────────────

const SAT_ICON = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">
  <g transform="translate(22,22) rotate(-40)">
    <rect x="-5" y="-7" width="10" height="14" rx="1.5"
          fill="#FFD700" stroke="#111" stroke-width="1.2"/>
    <rect x="-15" y="-4" width="9" height="8" rx="1"
          fill="#2563EB" stroke="#111" stroke-width="1.2"/>
    <rect x="6"  y="-4" width="9" height="8" rx="1"
          fill="#2563EB" stroke="#111" stroke-width="1.2"/>
    <line x1="0" y1="-7" x2="0" y2="-14"
          stroke="#FFD700" stroke-width="1.5"/>
    <circle cx="0" cy="-15" r="2.5"
            fill="none" stroke="#FFD700" stroke-width="1.5"/>
    <circle cx="0" cy="0" r="2"
            fill="#FF4444" stroke="#111" stroke-width="1"/>
  </g>
</svg>`)

// ─── Speed presets ────────────────────────────────────────────────────────

const SPEEDS = [
  { value: 1,    label: '1×'   },
  { value: 10,   label: '10×'  },
  { value: 60,   label: '60×'  },
  { value: 300,  label: '5m/s' },
  { value: 3600, label: '1h/s' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────

function ecefToCartesian3(pt) {
  return new Cesium.Cartesian3(pt.x * 1000, pt.y * 1000, pt.z * 1000)
}

function geoToCart(lat, lng, alt_m = 0) {
  return Cesium.Cartesian3.fromDegrees(lng, lat, alt_m)
}

// ─── Orbit info pills ─────────────────────────────────────────────────────

function Pill({ label, value }) {
  if (value == null) return null
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '4px 10px', borderRadius: 4,
      background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(27,108,168,0.4)',
    }}>
      <span style={{ fontSize: 8, fontFamily: 'JetBrains Mono,monospace', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono,monospace', fontWeight: 700, color: '#fff' }}>{value}</span>
    </div>
  )
}

// ─── Info panel (right slide-in) ──────────────────────────────────────────

function InfoPanel({ orbitData, onClose }) {
  const date = orbitData.net
    ? new Date(orbitData.net).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 25, width: 340,
      background: 'rgba(8,14,34,0.97)',
      borderLeft: '1px solid rgba(27,108,168,0.4)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
        background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(27,108,168,0.25)',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 9, fontFamily: 'JetBrains Mono,monospace', padding: '2px 7px',
          borderRadius: 3, background: 'rgba(27,108,168,0.3)',
          border: '1px solid rgba(27,108,168,0.6)', color: '#93C5FD',
        }}>
          {orbitData.orbitAbbrev || 'ORB'}
        </span>
        <span style={{
          flex: 1, fontSize: 13, fontWeight: 700, color: '#F1F5F9',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {orbitData.launchName?.split('|')[0]?.trim() || orbitData.launchName}
        </span>
        <button onClick={onClose} style={{
          color: '#6B7280', fontSize: 16, background: 'none', border: 'none',
          cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0,
        }}>✕</button>
      </div>

      {/* Scrollable body */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {orbitData.imageUrl && (
          <img
            src={orbitData.imageUrl}
            alt="Mission patch"
            style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
            onError={e => { e.target.style.display = 'none' }}
          />
        )}

        <div style={{ padding: '14px 16px' }}>
          {/* Name + provider */}
          <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', lineHeight: 1.3, marginBottom: 4 }}>
            {orbitData.launchName}
          </div>
          {orbitData.provider && (
            <div style={{ fontSize: 11, color: '#60A5FA', marginBottom: 10 }}>{orbitData.provider}</div>
          )}

          {/* Status / date badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
            {orbitData.status && (
              <span style={{
                fontSize: 9, fontFamily: 'JetBrains Mono,monospace', padding: '2px 8px',
                borderRadius: 3,
                background: orbitData.status === 'Success' ? 'rgba(21,128,61,0.4)' : 'rgba(127,29,29,0.4)',
                border: `1px solid ${orbitData.status === 'Success' ? 'rgba(74,222,128,0.5)' : 'rgba(248,113,113,0.5)'}`,
                color:  orbitData.status === 'Success' ? '#86EFAC' : '#FCA5A5',
              }}>
                {orbitData.status}
              </span>
            )}
            {date && <span style={{ fontSize: 10, color: '#94A3B8', alignSelf: 'center' }}>{date}</span>}
          </div>

          {/* Vehicle */}
          {orbitData.vehicleName && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono,monospace', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Vehicle</div>
              <div style={{ fontSize: 12, color: '#CBD5E1' }}>{orbitData.vehicleName}</div>
            </div>
          )}

          {/* Orbital params */}
          <div style={{
            marginBottom: 12, padding: '10px 12px',
            background: 'rgba(27,108,168,0.07)', border: '1px solid rgba(27,108,168,0.2)',
            borderRadius: 5,
          }}>
            <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono,monospace', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Orbital Parameters</div>
            {[
              ['Orbit class', orbitData.orbitAbbrev],
              ['Apogee',      orbitData.orbitElements?.apogee_km  != null ? `${orbitData.orbitElements.apogee_km.toLocaleString()} km`  : null],
              ['Perigee',     orbitData.orbitElements?.perigee_km != null ? `${orbitData.orbitElements.perigee_km.toLocaleString()} km` : null],
              ['Inclination', orbitData.orbitElements?.inclination_deg != null ? `${orbitData.orbitElements.inclination_deg.toFixed(1)}°` : null],
              ['RAAN',        orbitData.orbitElements?.raan_deg != null && orbitData.orbitElements.raan_deg !== 0 ? `${orbitData.orbitElements.raan_deg.toFixed(1)}°` : null],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono,monospace', color: '#64748B' }}>{label}</span>
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono,monospace', color: '#CBD5E1' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Mission description */}
          <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono,monospace', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Mission</div>
          {orbitData.missionDescription
            ? <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.7 }}>{orbitData.missionDescription}</div>
            : <div style={{ fontSize: 11, color: '#374151', fontStyle: 'italic', fontFamily: 'JetBrains Mono,monospace' }}>No description available in LL2.</div>
          }
        </div>
      </div>
    </div>
  )
}

// ─── Time controls bar ────────────────────────────────────────────────────

const BTN = {
  background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#D1D5DB', fontFamily: 'JetBrains Mono,monospace', fontSize: 11,
  cursor: 'pointer', padding: '4px 9px', borderRadius: 3, lineHeight: 1.2,
}

function TimeBar({ playing, speed, simTime, onPlayPause, onSpeedChange, onSkip }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
      background: 'rgba(0,0,0,0.78)', borderTop: '1px solid rgba(27,108,168,0.3)',
      padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6,
      fontFamily: 'JetBrains Mono,monospace',
    }}>
      {/* Skip controls */}
      <button onClick={() => onSkip(-1)}    title="Back 1 orbit"    style={BTN}>«</button>
      <button onClick={() => onSkip(-0.1)}  title="Back ~9 min"     style={BTN}>‹</button>
      <button onClick={onPlayPause} style={{ ...BTN, fontSize: 14, minWidth: 30, textAlign: 'center' }}>
        {playing ? '⏸' : '▶'}
      </button>
      <button onClick={() => onSkip(0.1)}   title="Forward ~9 min"  style={BTN}>›</button>
      <button onClick={() => onSkip(1)}     title="Forward 1 orbit"  style={BTN}>»</button>

      {/* Sim time */}
      <span style={{ fontSize: 10, color: '#6B7280', marginLeft: 6, whiteSpace: 'nowrap', flex: 1 }}>
        {simTime.toUTCString().slice(0, -7) + ' UTC'}
      </span>

      {/* Speed selector */}
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: '#4B5563', marginRight: 2 }}>Speed</span>
        {SPEEDS.map(s => (
          <button
            key={s.value}
            onClick={() => onSpeedChange(s.value)}
            style={{
              ...BTN,
              background: speed === s.value ? 'rgba(27,108,168,0.45)' : 'rgba(0,0,0,0.4)',
              borderColor: speed === s.value ? 'rgba(27,108,168,0.8)' : 'rgba(255,255,255,0.1)',
              color: speed === s.value ? '#93C5FD' : '#6B7280',
              minWidth: 34,
              textAlign: 'center',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export default function OrbitViewer({
  launchId,
  orbitData,
  height = 400,
  fullscreen = false,
}) {
  const containerRef  = useRef(null)
  const viewerRef     = useRef(null)
  const satEntityRef  = useRef(null)
  const periodMsRef   = useRef(null)
  const orbitDataRef  = useRef(null)

  const [initDone,    setInitDone]   = useState(false)
  const [initError,   setInitError]  = useState(null)
  const [elements,    setElements]   = useState(null)
  const [simTime,     setSimTime]    = useState(new Date())
  const [playing,     setPlaying]    = useState(true)
  const [speed,       setSpeed]      = useState(60)
  const [following,   setFollowing]  = useState(false)
  const [clickedInfo, setClickedInfo] = useState(null)

  // Keep orbitDataRef current so the one-time click handler always reads fresh data
  useEffect(() => { orbitDataRef.current = orbitData }, [orbitData])

  // ─── Cesium init (runs once) ─────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return

    const creditDiv = document.createElement('div')
    creditDiv.style.display = 'none'
    document.body.appendChild(creditDiv)

    let viewer = null
    try {
      viewer = new Cesium.Viewer(containerRef.current, {
        shouldAnimate:        false,
        timeline:             false,
        animation:            false,
        baseLayerPicker:      false,
        homeButton:           false,
        geocoder:             false,
        navigationHelpButton: false,
        fullscreenButton:     false,
        sceneModePicker:      false,
        infoBox:              false,
        selectionIndicator:   false,
        creditContainer:      creditDiv,
        baseLayer: Cesium.ImageryLayer.fromProviderAsync(
          Cesium.TileMapServiceImageryProvider.fromUrl('/cesium/Assets/Textures/NaturalEarthII')
        ),
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      })

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(0, 20, 20_000_000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
      })

      // Throttled clock tick → React simTime
      let lastTick = 0
      viewer.clock.onTick.addEventListener(clock => {
        const now = Date.now()
        if (now - lastTick > 250) {
          lastTick = now
          setSimTime(Cesium.JulianDate.toDate(clock.currentTime))
        }
      })

      // Left-click → show/hide info panel
      viewer.screenSpaceEventHandler.setInputAction(event => {
        const picked = viewer.scene.pick(event.position)
        if (Cesium.defined(picked?.id) && picked.id === satEntityRef.current) {
          setClickedInfo({ ...orbitDataRef.current })
        } else {
          setClickedInfo(null)
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

      // Hover → pointer cursor over satellite
      viewer.screenSpaceEventHandler.setInputAction(event => {
        const picked = viewer.scene.pick(event.endPosition)
        viewer.canvas.style.cursor =
          (Cesium.defined(picked?.id) && picked.id === satEntityRef.current) ? 'pointer' : ''
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

      viewerRef.current = viewer
      setInitDone(true)
    } catch (err) {
      console.error('[OrbitViewer] init failed:', err)
      setInitError(err.message ?? String(err))
      if (creditDiv.parentNode) document.body.removeChild(creditDiv)
      return
    }

    return () => {
      viewerRef.current = null
      setInitDone(false)
      if (!viewer.isDestroyed()) viewer.destroy()
      if (creditDiv.parentNode) document.body.removeChild(creditDiv)
    }
  }, [])

  // ─── Draw orbit on new orbitData ─────────────────────────────────────────

  useEffect(() => {
    if (!initDone || !viewerRef.current || !orbitData) return
    const viewer = viewerRef.current

    const elems     = ll2_orbit_to_elements(orbitData.orbitElements, orbitData.orbitAbbrev)
    const period_ms = compute_orbital_period_ms(elems.sma_km)
    const epoch_ms  = Date.now()
    const end_ms    = epoch_ms + period_ms * 3

    periodMsRef.current = period_ms
    setElements(elems)
    viewer.entities.removeAll()
    setClickedInfo(null)

    // ── Clock ─────────────────────────────────────────────────────────
    const startJD = Cesium.JulianDate.fromDate(new Date(epoch_ms))
    const stopJD  = Cesium.JulianDate.fromDate(new Date(end_ms))
    viewer.clock.startTime    = startJD.clone()
    viewer.clock.stopTime     = stopJD.clone()
    viewer.clock.currentTime  = startJD.clone()
    viewer.clock.multiplier   = speed
    viewer.clock.clockRange   = Cesium.ClockRange.LOOP_STOP
    viewer.clock.shouldAnimate = playing

    // ── Launch site ───────────────────────────────────────────────────
    const site = orbitData.launchSite
    if (site?.lat != null && site?.lng != null) {
      viewer.entities.add({
        position: geoToCart(site.lat, site.lng, 0),
        point: {
          pixelSize: 8, color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE, outlineWidth: 1.5,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: site.name || 'Launch Site',
          font: '11px JetBrains Mono,monospace',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      })
    }

    // ── Orbital ellipse ───────────────────────────────────────────────
    viewer.entities.add({
      polyline: {
        positions: build_orbital_ellipse_points(elems, epoch_ms, 360).map(ecefToCartesian3),
        width: 1.5,
        material: new Cesium.ColorMaterialProperty(Cesium.Color.WHITE.withAlpha(0.55)),
        arcType: Cesium.ArcType.NONE,
      },
    })

    // ── Ground track + SampledPositionProperty ────────────────────────
    let trackPts
    if (orbitData.tle?.line1 && orbitData.tle?.line2) {
      const sr = satellite.twoline2satrec(orbitData.tle.line1, orbitData.tle.line2)
      trackPts = propagate_ground_track(sr, epoch_ms, end_ms, 30_000)
    } else {
      trackPts = propagate_ground_track_from_elements(elems, epoch_ms, end_ms, 30_000)
    }

    // Build SampledPositionProperty so Cesium interpolates smoothly
    const posProp = new Cesium.SampledPositionProperty()
    posProp.forwardExtrapolationType  = Cesium.ExtrapolationType.HOLD
    posProp.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD
    trackPts.forEach(pt => {
      posProp.addSample(
        Cesium.JulianDate.fromDate(new Date(pt.timestamp)),
        geoToCart(pt.lat, pt.lng, (pt.alt_km ?? (elems.sma_km - 6371)) * 1000)
      )
    })

    // Dashed ground track polyline segments (split at antimeridian)
    const segs = [[]]
    for (let i = 0; i < trackPts.length; i++) {
      if (i > 0 && Math.abs(trackPts[i].lng - trackPts[i - 1].lng) > 180) segs.push([])
      segs[segs.length - 1].push(trackPts[i])
    }
    segs.forEach(s => {
      if (s.length < 2) return
      viewer.entities.add({
        polyline: {
          positions: s.map(p => geoToCart(p.lat, p.lng, (p.alt_km ?? 400) * 1000)),
          width: 1.5,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#3B82F6').withAlpha(0.75),
          }),
          arcType: Cesium.ArcType.NONE,
        },
      })
    })

    // ── Ascending node marker ─────────────────────────────────────────
    viewer.entities.add({
      position: geoToCart(0, elems.raan_deg, (elems.apogee_km + elems.perigee_km) / 2 * 1000),
      point: {
        pixelSize: 7, color: Cesium.Color.LIME,
        outlineColor: Cesium.Color.WHITE, outlineWidth: 1,
      },
      label: {
        text: 'AN', font: '9px JetBrains Mono,monospace',
        fillColor: Cesium.Color.LIME, pixelOffset: new Cesium.Cartesian2(10, 0),
      },
    })

    // ── Satellite entity — billboard icon + label ─────────────────────
    const satEnt = viewer.entities.add({
      position: posProp,
      billboard: {
        image: SAT_ICON,
        scale: 0.85,
        verticalOrigin:   Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        eyeOffset: new Cesium.Cartesian3(0, 0, -500),
        // Always render on top of the ellipse
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: orbitData.launchName ? orbitData.launchName.split('|')[0].trim() : 'Payload',
        font: '10px JetBrains Mono,monospace',
        fillColor: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(20, 0),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    satEntityRef.current = satEnt

    viewer.flyTo(viewer.entities, {
      duration: 1.5,
      offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-55), 0),
    })
  }, [initDone, orbitData])

  // ─── Sync clock when playing / speed changes ─────────────────────────────

  useEffect(() => {
    if (!viewerRef.current) return
    viewerRef.current.clock.shouldAnimate = playing
    viewerRef.current.clock.multiplier    = speed
  }, [playing, speed])

  // ─── Follow satellite ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!viewerRef.current) return
    viewerRef.current.trackedEntity = following ? satEntityRef.current : undefined
  }, [following])

  // ─── Reset camera ─────────────────────────────────────────────────────────

  const resetCamera = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.trackedEntity = undefined
    setFollowing(false)
    viewer.flyTo(viewer.entities, {
      duration: 1.5,
      offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-55), 0),
    })
  }, [])

  // ─── Skip time ───────────────────────────────────────────────────────────

  const handleSkip = useCallback((orbits) => {
    const viewer = viewerRef.current
    if (!viewer || !periodMsRef.current) return
    const clock = viewer.clock
    const deltaSec = (orbits * periodMsRef.current) / 1000
    const next = Cesium.JulianDate.addSeconds(clock.currentTime, deltaSec, new Cesium.JulianDate())
    if (Cesium.JulianDate.lessThan(next, clock.startTime))        clock.currentTime = clock.startTime.clone()
    else if (Cesium.JulianDate.greaterThan(next, clock.stopTime)) clock.currentTime = clock.stopTime.clone()
    else                                                           clock.currentTime = next
  }, [])

  // ─── Export PNG ───────────────────────────────────────────────────────────

  const exportPNG = useCallback(() => {
    if (!viewerRef.current) return
    const a = document.createElement('a')
    a.href = viewerRef.current.canvas.toDataURL('image/png')
    a.download = `orbit_${launchId || 'view'}.png`
    a.click()
  }, [launchId])

  // ─── Render ───────────────────────────────────────────────────────────────

  const info = elements ? {
    period:  `${(compute_orbital_period_ms(elements.sma_km) / 60000).toFixed(1)} min`,
    apogee:  `${elements.apogee_km.toFixed(0)} km`,
    perigee: `${elements.perigee_km.toFixed(0)} km`,
    incl:    `${elements.inclination_deg.toFixed(1)}°`,
    ecc:     elements.eccentricity.toFixed(4),
  } : null

  const INFO_PANEL_W = 340
  const panelOpen = !!clickedInfo

  return (
    <div style={{ position: 'relative', height: fullscreen ? '100vh' : height, width: '100%', background: '#000' }}>
      {/* Cesium canvas fills everything; info panel overlays on top */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Right info panel */}
      {panelOpen && <InfoPanel orbitData={clickedInfo} onClose={() => setClickedInfo(null)} />}

      {/* Top-left toolbar */}
      <div style={{
        position: 'absolute',
        top: fullscreen ? 46 : 8,
        left: 12,
        display: 'flex', gap: 6, zIndex: 15,
      }}>
        <button onClick={resetCamera} style={OVERLAY_BTN}>⊕ Reset Camera</button>
        <button
          onClick={() => setFollowing(f => !f)}
          style={{
            ...OVERLAY_BTN,
            background: following ? 'rgba(27,108,168,0.45)' : 'rgba(0,0,0,0.6)',
            borderColor: following ? 'rgba(27,108,168,0.8)' : 'rgba(27,108,168,0.4)',
            color: following ? '#93C5FD' : '#9CA3AF',
          }}
        >
          ◉ {following ? 'Unfollow' : 'Follow Satellite'}
        </button>
        <button onClick={exportPNG} style={OVERLAY_BTN}>↓ Export PNG</button>
      </div>

      {/* Top-right orbit pills (shift left when panel is open) */}
      {info && (
        <div style={{
          position: 'absolute',
          top: fullscreen ? 46 : 8,
          right: panelOpen ? INFO_PANEL_W + 10 : 12,
          display: 'flex', flexWrap: 'wrap', gap: 5,
          zIndex: 15, pointerEvents: 'none',
          transition: 'right 0.2s',
        }}>
          <Pill label="Period"  value={info.period}  />
          <Pill label="Apogee"  value={info.apogee}  />
          <Pill label="Perigee" value={info.perigee} />
          <Pill label="Incl."   value={info.incl}    />
          <Pill label="Ecc."    value={info.ecc}     />
        </div>
      )}

      {/* Click-hint */}
      {initDone && elements && !panelOpen && (
        <div style={{
          position: 'absolute', top: fullscreen ? 46 : 8, left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '3px 10px',
          fontFamily: 'JetBrains Mono,monospace', fontSize: 9, color: '#6B7280',
          pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 15,
        }}>
          Click the satellite icon for mission details
        </div>
      )}

      {/* Time controls bar */}
      {initDone && (
        <TimeBar
          playing={playing}
          speed={speed}
          simTime={simTime}
          onPlayPause={() => setPlaying(p => !p)}
          onSpeedChange={setSpeed}
          onSkip={handleSkip}
        />
      )}

      {/* Init error */}
      {initError && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', zIndex: 50 }}>
          <div style={{ textAlign: 'center', padding: '0 24px' }}>
            <div style={{ color: '#F87171', fontSize: 11, fontFamily: 'JetBrains Mono,monospace', marginBottom: 8, letterSpacing: '0.1em' }}>CESIUM INIT FAILED</div>
            <div style={{ color: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono,monospace', maxWidth: 400, wordBreak: 'break-all' }}>{initError}</div>
          </div>
        </div>
      )}

      {/* Loading */}
      {!initDone && !initError && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', zIndex: 50 }}>
          <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono,monospace', color: '#6B7280', letterSpacing: '0.15em' }}>
            INITIALISING CESIUM…
          </div>
        </div>
      )}
    </div>
  )
}

const OVERLAY_BTN = {
  background: 'rgba(0,0,0,0.6)',
  border: '1px solid rgba(27,108,168,0.4)',
  color: '#9CA3AF',
  fontFamily: 'JetBrains Mono,monospace',
  fontSize: 10,
  cursor: 'pointer',
  padding: '4px 10px',
  borderRadius: 4,
}
