import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import DataSourceTag from './DataSourceTag'

// Fix Leaflet default icon paths broken by Vite's asset pipeline
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom accent-colored marker
const accentIcon = new L.DivIcon({
  className: '',
  html: `<div style="
    width:14px;height:14px;border-radius:50%;
    background:#1B6CA8;border:2px solid #fff;
    box-shadow:0 0 8px rgba(27,108,168,0.9);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10],
})

function FlyToLaunchSite({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    if (lat && lng) map.flyTo([parseFloat(lat), parseFloat(lng)], 7, { duration: 1.2 })
  }, [lat, lng, map])
  return null
}

export default function LaunchSiteMap({ launch, fetchedAt }) {
  const lat = parseFloat(launch?.pad?.latitude || '28.56')
  const lng = parseFloat(launch?.pad?.longitude || '-80.58')
  const padName = launch?.pad?.name || '—'
  const padLocation = launch?.pad?.location?.name || '—'
  const icao = launch?.pad?.icao || '—'

  return (
    <div className="panel p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-mono text-accent tracking-widest uppercase">Launch Site</span>
        <span className="text-[10px] font-mono text-gray-500 truncate">— {padName}</span>
        <DataSourceTag source="LL2 v2.2.0 pad data" fetchedAt={fetchedAt} />
      </div>

      <div className="rounded overflow-hidden border border-accent/30 flex-1" style={{ minHeight: 220 }}>
        <MapContainer
          center={[lat, lng]}
          zoom={7}
          style={{ height: '100%', minHeight: 220, width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FlyToLaunchSite lat={lat} lng={lng} />
          <Marker position={[lat, lng]} icon={accentIcon}>
            <Popup>
              <div className="font-mono text-xs leading-relaxed">
                <div className="font-bold text-white mb-1">{padName}</div>
                <div className="text-gray-600">{padLocation}</div>
                <div className="text-gray-400 mt-1">ICAO: {icao}</div>
                <div className="text-gray-500 text-[10px] mt-1">
                  {lat.toFixed(4)}°, {lng.toFixed(4)}°
                </div>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-mono">
        <div>
          <span className="text-gray-500">LAT </span>
          <span className="text-[#1A1F36]">{lat.toFixed(4)}°</span>
        </div>
        <div>
          <span className="text-gray-500">LNG </span>
          <span className="text-[#1A1F36]">{lng.toFixed(4)}°</span>
        </div>
        <div>
          <span className="text-gray-500">ICAO </span>
          <span className="text-[#1A1F36]">{icao}</span>
        </div>
      </div>
    </div>
  )
}
