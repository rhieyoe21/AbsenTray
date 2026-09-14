import { useEffect, useState } from 'react'
import { getSocket, onSocketEvent, isSocketConnected } from '../services/socket'

export function useWebSocket() {
  const [socket] = useState(() => getSocket())
  const [isConnected, setIsConnected] = useState(isSocketConnected())
  const [attendanceEvents, setAttendanceEvents] = useState([])
  const [deviceEvents, setDeviceEvents] = useState([])

  useEffect(() => {
    // Track connection state
    const onConnect = () => setIsConnected(true)
    const onDisconnect = (reason) => {
      setIsConnected(false)
      // Debug helper for the observed "disconnected on navigation" bug
      console.log('[useWebSocket] disconnected, reason:', reason)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    if (socket.connected) setIsConnected(true)

    // Listen to shared events using registry (no duplicate listeners)
    const offAttendance = onSocketEvent('attendance:new', (data) => {
      setAttendanceEvents((prev) => [data, ...prev].slice(0, 50))
    })

    const offOffline = onSocketEvent('device:offline', (data) => {
      setDeviceEvents((prev) => [
        ...prev,
        { ...data, type: 'offline', timestamp: new Date() }
      ])
    })

    const offRecovered = onSocketEvent('device:recovered', (data) => {
      setDeviceEvents((prev) => [
        ...prev,
        { ...data, type: 'recovered', timestamp: new Date() }
      ])
    })

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      offAttendance()
      offOffline()
      offRecovered()
    }
  }, [socket])

  return {
    socket,
    isConnected,
    attendanceEvents,
    deviceEvents
  }
}

export default useWebSocket