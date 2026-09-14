import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardAPI } from '../services/api'
import { useWebSocket } from '../hooks/useWebSocket'
import LoadingSpinner from '../components/common/LoadingSpinner'
import DeviceStatus from '../components/dashboard/DeviceStatus'

export default function Monitoring() {
  const { isConnected, attendanceEvents, deviceEvents } = useWebSocket()

  const { data: retryQueue, isLoading } = useQuery({
    queryKey: ['retry-queue'],
    queryFn: () => dashboardAPI.getRetryQueue(),
    refetchInterval: 10000
  })

  const { data: deviceLogs } = useQuery({
    queryKey: ['device-logs'],
    queryFn: () => dashboardAPI.getDeviceStatus(),
    refetchInterval: 30000
  })

  if (isLoading) return <LoadingSpinner />

  const pendingRetries = Array.isArray(retryQueue?.data?.items)
    ? retryQueue.data.items
    : Array.isArray(retryQueue?.data)
      ? retryQueue.data
      : []

  const fmtDateTime = (t) => {
    try {
      return new Date(String(t).replace(' ', 'T') + (typeof t === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t) ? 'Z' : '')).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    } catch {
      return '—'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="mb-6">
          <h1 className="text-2xl font-semibold">Pemantauan</h1>
          <p className="text-sm text-base-content/60">Status perangkat, antrean kirim ulang, dan log sistem.</p>
        </header>

      {/* Connection Status
      <div className={`alert ${isConnected ? 'alert-success' : 'alert-warning'}`}>
        <div className="flex-1">
          <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-warning'}`} />
          <span className="font-medium">
            {isConnected ? 'Kanal waktu nyata terhubung' : 'Menghubungkan kembali…'}
          </span>
        </div>
          <p className="text-sm">
            Real-time updates: {isConnected ? 'Live' : 'Reconnecting...'}
          </p>
        </div>
      </div> */}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Status */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Perangkat fingerprint</h2>
            <DeviceStatus />
          </div>
        </div>

        {/* Live Attendance Feed */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Aliran absensi langsung</h2>
            
            {attendanceEvents.length === 0 ? (
              <p className="text-center text-base-content/50 py-8">
                Waiting for attendance events...
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {attendanceEvents.map((event, index) => (
                  <div key={index} className="p-3 rounded-lg bg-base-200 animate-fade-in">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium">{event.userName}</span>
                        <span className="text-xs pl-2">
                          {fmtDateTime(event.time)}
                        </span>
                      </div>
                      <span className={`badge badge-sm ${
                        event.status === 'sent' ? 'badge-success' : 'badge-warning'
                      }`}>
                        {event.status === 'sent' ? 'Terkirim' : 'Menunggu'}
                      </span>
                    </div>
                    <p className="text-xs opacity-75 mt-1">
                      Mode: {event.mode} | Transaction: {event.transactionId}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Device Events */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Peristiwa perangkat</h2>
            
            {deviceEvents.length === 0 ? (
              <p className="text-center text-base-content/50 py-8">
                Belum ada peristiwa perangkat.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {deviceEvents.map((event, index) => (
                  <div key={index} className="p-3 rounded-lg bg-base-200">
                    <div className="flex justify-between">
                      <span className={`badge badge-sm ${
                        event.type === 'online' || event.type === 'recovered' 
                          ? 'badge-success' : 'badge-error'
                      }`}>
                        {event.type}
                      </span>
                      <span className="text-xs font-mono opacity-75">
                        {event.timestamp || '—'}
                      </span>
                    </div>
                    {event.error && (
                      <p className="text-xs mt-1 opacity-75">{event.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Retry Queue */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">
              Antrean kirim ulang
              {pendingRetries.length > 0 && (
                <span className="badge badge-warning">{pendingRetries.length} pending</span>
              )}
            </h2>
            
            {pendingRetries.length === 0 ? (
              <div className="text-center text-base-content/50 py-8">
                
                <p>All messages sent successfully</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-zebra table-sm">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Number</th>
                      <th>Attempt</th>
                      <th>Next Retry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRetries.map((item, index) => (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td className="font-mono text-xs">{item.whatsapp_number}</td>
                        <td>{item.attempt} / {item.max_attempts}</td>
                        <td className="font-mono text-xs">{fmtDateTime(item.next_retry_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Logs */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Log perangkat terbaru</h2>
          
          {deviceLogs?.data?.recentLogs?.length === 0 ? (
            <p className="text-center text-base-content/50 py-4">
              No system logs yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra table-sm">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>IP</th>
                    <th>Status</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {(deviceLogs?.data?.recentLogs || []).slice(0, 20).map((log) => (
                    <tr key={log.id}>
                      <td className="font-mono text-xs">{fmtDateTime(log.created_at)}</td>
                      <td className="font-mono text-xs">{log.device_ip}</td>
                      <td>
                        <span className={`badge badge-sm ${
                          log.status === 'online' ? 'badge-success' :
                          log.status === 'offline' ? 'badge-error' :
                          log.status === 'connecting' ? 'badge-info' :
                          'badge-warning'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="text-xs">{log.message || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}