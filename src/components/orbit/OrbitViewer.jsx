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

// ─── Helpers ──────────────────────────────────────────────────────────────

function ecefToCartesian3(pt) {
  return new Cesium.Cartesian3(pt.x * 1000, pt.y * 1000, pt.z * 1000)
}

function geoToCartesian3(lat, lng, alt_m = 0) {
  return Cesium.Cartesian3.fromDegrees(lng, lat, alt_m)
}

// ─── Orbit info pills ─────────────────────────────────────────────────────

function Pill({ label, value }) {
  if (value == null) return null
  return (
    <div className="flex flex-col items-center px-2.5 py-1 rounded"
         style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(27,108,168,0.4)' }}>
      <span className="text-[8px] font-mono text-gray-400 uppercase tracking-widest">{label}</span>
      <span className="text-[11px] font-mono font-bold text-white">{value}</span>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export default function OrbitViewer({
  launchId,
  orbitData,           // { orbitElements, tle, launchSite, orbitAbbrev, launchName }
  height = 400,
  fullscreen = false,
}) {
  const containerRef = useRef(null)
  const viewerRef    = useRef(null)
  const satEntityRef = useRef(null)
  const satrec       = useRef(null)

  const [following,   setFollowing]  = useState(false)
  const [simTime,     setSimTime]    = useState(new Date())
  const [elements,    setElements]   = useState(null)
  const [initDone,    setInitDone]   = useState(false)
  const [initError,   setInitError]  = useState(null)

  // ─── Cesium initialisation ──────────────────────────────────────────────
  // Keep this identical to the working Cesium Sandcastle pattern:
  // new Cesium.Viewer(container, minimalOptions) — no custom imagery setup,
  // just let the default Ion World Imagery load via the token in VITE_CESIUM_TOKEN.

  useEffect(() => {
    if (!containerRef.current) return

    // Append a hidden credit div to the document so Cesium doesn't reject a
    // detached node (some versions throw when creditContainer is off-DOM).
    const creditDiv = document.createElement('div')
    creditDiv.style.display = 'none'
    document.body.appendChild(creditDiv)

    let viewer = null
    try {
      viewer = new Cesium.Viewer(containerRef.current, {
        shouldAnimate:        true,
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
        // Explicit path avoids buildModuleUrl misresolving when Cesium is in
        // optimizeDeps.exclude (the define replacement may not reach its files).
        baseLayer: Cesium.ImageryLayer.fromProviderAsync(
          Cesium.TileMapServiceImageryProvider.fromUrl(
            '/cesium/Assets/Textures/NaturalEarthII'
          )
        ),
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      })
      // Point straight down at Earth from 20 Mm so the first frame always
      // shows the globe rather than the sky/atmosphere.
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(0, 20, 20_000_000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
      })
      viewerRef.current = viewer
      setInitDone(true)
    } catch (err) {
      console.error('[OrbitViewer] Cesium init failed:', err)
      setInitError(err.message ?? String(err))
      document.body.removeChild(creditDiv)
      return
    }

    return () => {
      viewerRef.current = null
      setInitDone(false)
      if (!viewer.isDestroyed()) viewer.destroy()
      if (creditDiv.parentNode) document.body.removeChild(creditDiv)
    }
  }, [])

  // ─── Draw orbit entities whenever orbitData or viewer changes ───────────

  useEffect(() => {
    if (!initDone || !viewerRef.current || !orbitData) return
    const viewer = viewerRef.current

    // Derive Keplerian elements
    const elems = ll2_orbit_to_elements(
      orbitData.orbitElements,
      orbitData.orbitAbbrev
    )
    setElements(elems)

    const period_ms  = compute_orbital_period_ms(elems.sma_km)
    const epoch_ms   = Date.now()
    const endMs      = epoch_ms + period_ms * 3   // 3 full orbits

    viewer.entities.removeAll()

    // ── a. Launch site ─────────────────────────────────────────────────
    const site = orbitData.launchSite
    if (site?.lat != null && site?.lng != null) {
      viewer.entities.add({
        position: geoToCartesian3(site.lat, site.lng, 0),
        point: {
          pixelSize: 8,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1.5,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: site.name || 'Launch Site',
          font: '11px JetBrains Mono, monospace',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          show: true,
        },
      })
    }

    // ── b. Orbital ellipse (white polyline, 360 pts) ───────────────────
    const ellipsePts = build_orbital_ellipse_points(elems, epoch_ms, 360)
    viewer.entities.add({
      polyline: {
        positions: ellipsePts.map(ecefToCartesian3),
        width: 1.5,
        material: new Cesium.ColorMaterialProperty(
          Cesium.Color.WHITE.withAlpha(0.6)
        ),
        arcType: Cesium.ArcType.NONE,
      },
    })

    // ── c. Ground track (blue polyline, 3 orbits) ─────────────────────
    let trackPts
    if (orbitData.tle?.line1 && orbitData.tle?.line2) {
      satrec.current = satellite.twoline2satrec(orbitData.tle.line1, orbitData.tle.line2)
      trackPts = propagate_ground_track(satrec.current, epoch_ms, endMs, 30_000)
    } else {
      trackPts = propagate_ground_track_from_elements(elems, epoch_ms, endMs, 30_000)
    }

    // Split track at antimeridian crossings to avoid wraparound artifacts
    const segments = []
    let seg = []
    for (let i = 0; i < trackPts.length; i++) {
      if (i > 0 && Math.abs(trackPts[i].lng - trackPts[i - 1].lng) > 180) {
        segments.push(seg); seg = []
      }
      seg.push(trackPts[i])
    }
    if (seg.length) segments.push(seg)

    segments.forEach(s => {
      if (s.length < 2) return
      viewer.entities.add({
        polyline: {
          positions: s.map(p => geoToCartesian3(p.lat, p.lng, (p.alt_km ?? 400) * 1000)),
          width: 1.5,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#3B82F6').withAlpha(0.8),
          }),
          arcType: Cesium.ArcType.NONE,
        },
      })
    })

    // ── d. Orbital plane disc ──────────────────────────────────────────
    const halfEllipse = build_orbital_ellipse_points(elems, epoch_ms, 180)
    const center      = ecefToCartesian3({ x: 0, y: 0, z: 0 })
    const planePositions = [
      center,
      ...halfEllipse.map(ecefToCartesian3),
    ]
    viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(planePositions),
        material: Cesium.Color.fromCssColorString('#1B6CA8').withAlpha(0.07),
        perPositionHeight: true,
        arcType: Cesium.ArcType.NONE,
      },
    })

    // ── e. Ascending node (RAAN crossing) ─────────────────────────────
    const raanLng = elems.raan_deg
    viewer.entities.add({
      position: geoToCartesian3(0, raanLng, (elems.apogee_km + elems.perigee_km) / 2 * 1000),
      point: {
        pixelSize: 7,
        color: Cesium.Color.LIME,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
      },
      label: {
        text: 'AN',
        font: '9px JetBrains Mono, monospace',
        fillColor: Cesium.Color.LIME,
        pixelOffset: new Cesium.Cartesian2(10, 0),
      },
    })

    // ── f. Live satellite position (if TLE or initial computed pos) ───
    const pos0 = trackPts[0]
    if (pos0) {
      const satEnt = viewer.entities.add({
        position: geoToCartesian3(pos0.lat, pos0.lng, (pos0.alt_km ?? 400) * 1000),
        point: {
          pixelSize: 10,
          color: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1.5,
        },
        label: {
          text: orbitData.launchName ? orbitData.launchName.split('|')[0].trim() : 'Payload',
          font: '10px JetBrains Mono, monospace',
          fillColor: Cesium.Color.YELLOW,
          pixelOffset: new Cesium.Cartesian2(14, 0),
        },
      })
      satEntityRef.current = satEnt
    }

    // ── Camera: zoom to fit all entities automatically ────────────────
    // viewer.flyTo computes the bounding sphere of all entities so the
    // camera is always positioned correctly regardless of orbit type.
    viewer.flyTo(viewer.entities, {
      duration: 1.5,
      offset: new Cesium.HeadingPitchRange(
        0,
        Cesium.Math.toRadians(-55),
        0  // distance auto-computed from bounding sphere
      ),
    })
  }, [initDone, orbitData])

  // ─── Live satellite update every 5 s ────────────────────────────────────

  useEffect(() => {
    if (!initDone || !satEntityRef.current || !elements) return

    const tick = () => {
      const now = new Date()
      setSimTime(now)

      let lat, lng, alt_km
      if (satrec.current) {
        const pv = satellite.propagate(satrec.current, now)
        if (!pv?.position || isNaN(pv.position.x)) return
        const gmst = satellite.gstime(now)
        const gd   = satellite.eciToGeodetic(pv.position, gmst)
        lat    = satellite.degreesLat(gd.latitude)
        lng    = satellite.degreesLong(gd.longitude)
        alt_km = gd.height
      } else {
        const pos = { lat: 0, lng: 0, alt_km: elements.sma_km - 6371 }  // approx mean alt
        lat = pos.lat; lng = pos.lng; alt_km = pos.alt_km
      }

      if (satEntityRef.current) {
        satEntityRef.current.position = geoToCartesian3(lat, lng, alt_km * 1000)
      }

      if (following && viewerRef.current) {
        viewerRef.current.camera.setView({
          destination: geoToCartesian3(lat, lng, (alt_km + 1200) * 1000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch:   Cesium.Math.toRadians(-45),
            roll:    0,
          },
        })
      }
    }

    tick()
    const id = setInterval(tick, 5000)
    return () => clearInterval(id)
  }, [initDone, elements, following])

  // ─── Reset camera ────────────────────────────────────────────────────────

  const resetCamera = useCallback(() => {
    if (!viewerRef.current) return
    viewerRef.current.flyTo(viewerRef.current.entities, {
      duration: 1.5,
      offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-55), 0),
    })
  }, [])

  // ─── Export screenshot ───────────────────────────────────────────────────

  const exportPNG = useCallback(() => {
    if (!viewerRef.current) return
    const canvas  = viewerRef.current.canvas
    const dataUrl = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `orbit_${launchId || 'view'}.png`
    a.click()
  }, [launchId])

  // ─── Render ──────────────────────────────────────────────────────────────

  const info = elements ? {
    period: `${(compute_orbital_period_ms(elements.sma_km) / 60000).toFixed(1)} min`,
    apogee: `${elements.apogee_km.toFixed(0)} km`,
    perigee: `${elements.perigee_km.toFixed(0)} km`,
    incl: `${elements.inclination_deg.toFixed(1)}°`,
    ecc: elements.eccentricity.toFixed(4),
  } : null

  return (
    <div style={{ position: 'relative', height: fullscreen ? '100vh' : height, width: '100%', background: '#000' }}>
      {/* Cesium canvas — absolute so it fills the parent without relying on height inheritance */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Controls overlay */}
      <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, pointerEvents: 'none' }}>
        {/* Orbit info pills */}
        {info && (
          <div className="flex flex-wrap gap-1.5 mb-2" style={{ pointerEvents: 'auto' }}>
            <Pill label="Period"   value={info.period}  />
            <Pill label="Apogee"   value={info.apogee}  />
            <Pill label="Perigee"  value={info.perigee} />
            <Pill label="Incl."    value={info.incl}    />
            <Pill label="Ecc."     value={info.ecc}     />
          </div>
        )}

        {/* Buttons row */}
        <div className="flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
          <button
            type="button"
            onClick={resetCamera}
            className="text-[10px] font-mono px-2.5 py-1 rounded border text-gray-300 hover:text-white transition-colors"
            style={{ background: 'rgba(0,0,0,0.6)', borderColor: 'rgba(27,108,168,0.5)' }}
          >
            ⊕ Reset Camera
          </button>
          <button
            type="button"
            onClick={() => setFollowing(f => !f)}
            className="text-[10px] font-mono px-2.5 py-1 rounded border transition-colors"
            style={{
              background: following ? 'rgba(27,108,168,0.4)' : 'rgba(0,0,0,0.6)',
              borderColor: 'rgba(27,108,168,0.5)',
              color: following ? '#93C5FD' : '#9CA3AF',
            }}
          >
            ◉ {following ? 'Unfollow' : 'Follow Satellite'}
          </button>
          <button
            type="button"
            onClick={exportPNG}
            className="text-[10px] font-mono px-2.5 py-1 rounded border text-gray-300 hover:text-white transition-colors"
            style={{ background: 'rgba(0,0,0,0.6)', borderColor: 'rgba(27,108,168,0.5)' }}
          >
            ↓ Export PNG
          </button>
          <span className="ml-auto text-[9px] font-mono text-gray-500"
                style={{ background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: 4 }}>
            {simTime.toUTCString().replace('GMT', 'UTC')}
          </span>
        </div>
      </div>

      {/* Init error — surfaces the exact Cesium exception so it's diagnosable */}
      {initError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-center px-6">
            <div className="text-red-400 text-[11px] font-mono mb-2 tracking-widest">CESIUM INIT FAILED</div>
            <div className="text-gray-400 text-[10px] font-mono max-w-md break-words">{initError}</div>
          </div>
        </div>
      )}

      {/* Loading overlay while Cesium boots */}
      {!initDone && !initError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-[11px] font-mono text-gray-400 tracking-widest animate-pulse">
            INITIALISING CESIUM…
          </div>
        </div>
      )}
    </div>
  )
}
