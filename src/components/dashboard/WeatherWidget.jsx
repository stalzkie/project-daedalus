import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import DataSourceTag from './DataSourceTag'

// Open-Meteo WMO weather code descriptions
const WMO_DESCRIPTIONS = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm + hail', 99: 'Thunderstorm + heavy hail',
}

const WMO_ICON = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '❄️', 73: '❄️', 75: '❄️', 77: '❄️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
}

function windDir(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

function launchGoNogo(wx) {
  if (!wx) return null
  const { windspeed, weathercode } = wx
  if ([95, 96, 99, 82].includes(weathercode)) return { verdict: 'NO-GO', reason: 'Active thunderstorm' }
  if (windspeed > 55) return { verdict: 'NO-GO', reason: `Wind ${windspeed} km/h exceeds limit` }
  if (windspeed > 40) return { verdict: 'CAUTION', reason: `Wind ${windspeed} km/h — elevated` }
  if ([80, 81, 61, 63, 65].includes(weathercode)) return { verdict: 'CAUTION', reason: 'Precipitation present' }
  return { verdict: 'GO', reason: 'Conditions nominal' }
}

async function fetchWeather(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&wind_speed_unit=kmh`
  const { data } = await axios.get(url)
  return data
}

export default function WeatherWidget({ launch, fetchedAt }) {
  const lat = parseFloat(launch?.pad?.latitude || '0')
  const lng = parseFloat(launch?.pad?.longitude || '0')
  const padName = launch?.pad?.location?.name || 'Launch Site'

  const { data, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['weather', lat, lng],
    queryFn: () => fetchWeather(lat, lng),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: !!lat && !!lng,
  })

  const wx = data?.current_weather
  const gono = launchGoNogo(wx)
  const wmoCode = wx?.weathercode
  const icon = WMO_ICON[wmoCode] || '🌡️'
  const desc = WMO_DESCRIPTIONS[wmoCode] || 'Unknown'
  const wxFetchedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : fetchedAt

  const gonoColor = {
    'GO':      'text-green-700 border-green-300 bg-green-50',
    'CAUTION': 'text-yellow-700 border-yellow-300 bg-yellow-50',
    'NO-GO':   'text-red-700 border-red-300 bg-red-50',
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-mono text-accent tracking-widest uppercase">Weather</span>
        <span className="text-[10px] font-mono text-gray-500 truncate">— {padName}</span>
        <DataSourceTag source="Open-Meteo API" fetchedAt={wxFetchedAt} />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-4 justify-center text-gray-500 text-sm font-mono">
          <span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          Fetching meteorological data…
        </div>
      )}

      {isError && (
        <div className="text-red-600 text-xs font-mono py-2 text-center">
          Weather fetch failed — check network / CORS
        </div>
      )}

      {wx && (
        <>
          {/* GO/NO-GO verdict */}
          {gono && (
            <div className={`flex items-center justify-between px-3 py-2 rounded border mb-3 ${gonoColor[gono.verdict]}`}>
              <span className="font-mono text-sm font-bold">{gono.verdict}</span>
              <span className="text-[11px]">{gono.reason}</span>
            </div>
          )}

          {/* Weather readings */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <MetRow icon={icon} label="Conditions" value={desc} />
            <MetRow icon="🌡️" label="Temperature" value={`${wx.temperature} °C`} />
            <MetRow icon="💨" label="Wind Speed" value={`${wx.windspeed} km/h`} />
            <MetRow icon="🧭" label="Wind Dir" value={`${windDir(wx.winddirection)} (${wx.winddirection}°)`} />
          </div>

          <div className="mt-3 text-[9px] font-mono text-gray-600 text-right">
            Open-Meteo · {lat.toFixed(4)}°, {lng.toFixed(4)}°
          </div>
        </>
      )}

      {!wx && !isLoading && !isError && (
        <div className="text-gray-500 text-xs font-mono py-2 text-center">No coordinates available</div>
      )}
    </div>
  )
}

function MetRow({ icon, label, value }) {
  return (
    <div className="bg-[#F8FAFC] rounded px-2 py-1.5 border border-[rgba(27,108,168,0.1)]">
      <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-0.5">{label}</div>
      <div className="flex items-center gap-1.5">
        <span className="text-base leading-none">{icon}</span>
        <span className="font-mono font-semibold text-[#1A1F36] text-[12px]">{value}</span>
      </div>
    </div>
  )
}
