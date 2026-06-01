import { useEffect, useRef, useCallback } from 'react'

/**
 * Attempts a WebSocket connection to /ws; falls back gracefully if unavailable.
 * Calls onUpdate(data) whenever a LAUNCHES_UPDATE message arrives.
 */
export function useLaunchSocket(onUpdate) {
  const wsRef = useRef(null)
  const retriesRef = useRef(0)
  const MAX_RETRIES = 3

  const connect = useCallback(() => {
    if (retriesRef.current >= MAX_RETRIES) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${window.location.host}/ws`

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data)
          if (msg.type === 'LAUNCHES_UPDATE') onUpdate(msg.data, msg.fetchedAt)
        } catch (_) {}
      }

      ws.onerror = () => {
        ws.close()
      }

      ws.onclose = () => {
        wsRef.current = null
        retriesRef.current += 1
        // Exponential backoff — after MAX_RETRIES, React Query polling takes over
        if (retriesRef.current < MAX_RETRIES) {
          setTimeout(connect, Math.min(2 ** retriesRef.current * 1000, 30_000))
        }
      }
    } catch (_) {
      // WebSocket not available in this env; polling via React Query handles updates
    }
  }, [onUpdate])

  useEffect(() => {
    connect()
    return () => {
      if (wsRef.current) wsRef.current.close()
    }
  }, [connect])

  return wsRef
}
