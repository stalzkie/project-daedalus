/**
 * Shared authenticated LL2 axios instance.
 * All server-side LL2 requests must go through this to use the API key
 * and get 300 req/hr instead of the anonymous 15 req/hr limit.
 */
import axios from 'axios'

const LL2_BASE = 'https://ll.thespacedevs.com/2.2.0'

function ll2Headers() {
  const key = process.env.VITE_LL2_API_KEY
  return key ? { Authorization: `Token ${key}` } : {}
}

export const ll2 = {
  get(path, params = {}, timeout = 15_000) {
    return axios.get(`${LL2_BASE}${path}`, {
      params,
      headers: ll2Headers(),
      timeout,
    })
  },

  getUrl(url, timeout = 15_000) {
    return axios.get(url, { headers: ll2Headers(), timeout })
  },
}

export { LL2_BASE }
