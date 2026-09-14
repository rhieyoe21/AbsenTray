import { io } from 'socket.io-client'
import { WS_BASE_URL } from '../utils/constants'

// Singleton socket instance — prevents disconnects when navigating between
// pages (a new socket per hook instance caused repeated connect/disconnect).
let socket = null
let connectCount = 0

export function getSocket() {
  if (socket) return socket
  
  socket = io(WS_BASE_URL, {
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    transports: ['websocket']
  })
  
  socket.on('connect', () => console.log('[socket] connected'))
  socket.on('disconnect', (reason) => console.log('[socket] disconnected:', reason))
  socket.on('connect_error', (error) => console.error('[socket] error:', error.message))
  
  return socket
}

// Event listeners registry: keeps a single shared dispatcher, storing
// per-consumer callbacks instead of attaching multiple listeners.
const listeners = new Map() // event -> [callbacks]
const cache = new Map() // event -> latest payload

function dispatch(event, payload) {
  cache.set(event, payload)
  const cbs = listeners.get(event)
  if (cbs) cbs.forEach((cb) => cb(payload))
}

export function onSocketEvent(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, [])
    
    const s = getSocket()
    // eslint-disable-next-line no-unused-vars
    s.on(event, (payload) => dispatch(event, payload))
  }
  
  listeners.get(event).push(callback)
  
  // Replay cached payload immediately so late subscribers get latest value
  if (cache.has(event)) {
    callback(cache.get(event))
  }
  
  return () => {
    const cbs = listeners.get(event) || []
    const idx = cbs.indexOf(callback)
    if (idx >= 0) cbs.splice(idx, 1)
  }
}

// For components that only need connection status (no reconnect storms)
export function pingSocket() {
  connectCount++
  const s = getSocket()
  return () => { connectCount--; if (connectCount <= 0) { /* keep socket alive */ } }
}

export function isSocketConnected() {
  return socket ? socket.connected : false
}

export const socketEvents = {
  attendanceNew: 'attendance:new',
  deviceOffline: 'device:offline',
  deviceRecovered: 'device:recovered',
  retrySent: 'retry:sent',
  retryExhausted: 'retry:exhausted',
  pollingToggled: 'polling:toggled'
}

export default getSocket