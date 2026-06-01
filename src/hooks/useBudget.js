import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export function useBudget() {
  return useQuery({
    queryKey: ['api-status'],
    queryFn: async () => {
      const { data } = await axios.get('/api/status')
      return data
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
