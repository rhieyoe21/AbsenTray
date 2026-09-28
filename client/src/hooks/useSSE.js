import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_BASE_URL } from '../utils/constants'

const eventNames = ['attendance:new', 'device:offline', 'device:recovered', 'retry:sent', 'retry:exhausted', 'settings:updated']

export function useSSE() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const source = new EventSource(`${API_BASE_URL.replace(/\/$/, '')}/events`)
    const invalidate = (keys) => keys.forEach((queryKey) => {
      queryClient.invalidateQueries({ queryKey })
    })

    const handlers = {
      'attendance:new': () => invalidate([
        ['dashboard-stats'], ['recent-activities'], ['attendance-chart'], ['attendance']
      ]),
      'device:offline': () => invalidate([
        ['dashboard-stats'], ['device-status'], ['settings']
      ]),
      'device:recovered': () => invalidate([
        ['dashboard-stats'], ['device-status'], ['settings']
      ]),
      'retry:sent': () => invalidate([
        ['retry-queue'], ['dashboard-stats']
      ]),
      'retry:exhausted': () => invalidate([
        ['retry-queue'], ['dashboard-stats']
      ]),
      'settings:updated': () => invalidate([['settings']])
    }

    eventNames.forEach((name) => source.addEventListener(name, handlers[name]))
    source.onerror = () => {
      // EventSource automatically reconnects; avoid starting a second stream.
    }

    return () => {
      eventNames.forEach((name) => source.removeEventListener(name, handlers[name]))
      source.close()
    }
  }, [queryClient])
}

export default useSSE
