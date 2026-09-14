import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardAPI } from '../../services/api'

export default function DeviceStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ['device-status'],
    queryFn: () => dashboardAPI.getDeviceStatus(),
    refetchInterval: 30000
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <span className="loading loading-spinner loading-md"></span>
      </div>
    )
  }

  const status = data?.data?.status || {}
  const online = status.deviceOnline

  return (
    <div className="space-y-6">
      {/* Fingerprint Device */}
      <div className={`alert ${online ? 'alert-success' : 'alert-error'}`}>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-success' : 'bg-error'}`} />
            <h3 className="font-semibold">Perangkat fingerprint</h3>
          </div>
          <p className="text-sm">
            {online ? 'Terhubung dan memantau' : 'Offline atau tidak terjangkau'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="stat bg-base-100 rounded-lg p-4">
          <div className="stat-title">Last Poll</div>
          <div className="stat-value text-xl font-mono">
            {status.lastPollTime 
              ? new Date(status.lastPollTime).toLocaleTimeString('id-ID')
              : 'N/A'}
          </div>
        </div>

        <div className="stat bg-base-100 rounded-lg p-4">
          <div className="stat-title">Polling Interval</div>
          <div className="stat-value text-xl font-mono">
            {(status.pollingInterval / 1000) || 'N/A'}s
          </div>
        </div>

        <div className="stat bg-base-100 rounded-lg p-4">
          <div className="stat-title">Connected Devices</div>
          <div className="stat-value text-xl">
            {status.connectedDevices?.length || 0}
          </div>
        </div>

        <div className="stat bg-base-100 rounded-lg p-4">
          <div className="stat-title">Polling Enabled</div>
          <div className="stat-value text-xl">
            {status.pollingEnabled ? 'Aktif' : 'Mati'}
          </div>
        </div>
      </div>

      {/* Recent Device Logs */}
      {data?.data?.recentLogs?.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2 text-sm">Recent Device Logs</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data.data.recentLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="text-xs p-2 rounded-lg bg-base-200">
                <div className="flex justify-between">
                  <span className={`badge badge-sm ${
                    log.status === 'online' ? 'badge-success' : 'badge-error'
                  }`}>
                    {log.status}
                  </span>
                  <span className="font-mono opacity-50">
                    {new Date(log.created_at)}
                  </span>
                </div>
                <p className="mt-1 opacity-75">{log.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}