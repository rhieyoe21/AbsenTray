import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { settingsAPI } from '../../services/api'

export default function ControlPanel() {
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState(null)
  const [disconnecting, setDisconnecting] = useState(false)

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsAPI.get(),
    refetchInterval: 30000
  })

  const status = settingsData?.data?.status || {}
  const device = status.device || {}
  const waha = status.waha || {}
  const settings = settingsData?.data?.settings || {}
  const deviceOffline = !device.deviceOnline || !!device.manualDisconnected

  const pollEnabled = settings.polling_enabled
    ? settings.polling_enabled === '1'
    : device.pollingEnabled
  const scheduleEnabled = settings.schedule_enabled
    ? settings.schedule_enabled === '1'
    : !!device.scheduleEnabled

  const togglePolling = useMutation({
    mutationFn: (enabled) => settingsAPI.setPolling(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries(['settings'])
      toast.success('Polling diperbarui')
    },
    onError: () => toast.error('Gagal memperbarui polling')
  })

  const toggleSchedule = useMutation({
    mutationFn: (enabled) => settingsAPI.setScheduleMode(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries(['settings'])
      toast.success('Perilaku jadwal diperbarui')
    },
    onError: () => toast.error('Gagal memperbarui jadwal')
  })

  const handleRefresh = async () => {
    setRefreshing(true)
    setRefreshResult(null)
    try {
      const result = await settingsAPI.reconnect()
      setRefreshResult(result?.data)
      queryClient.invalidateQueries(['settings'])
      toast.success('Koneksi diperbarui')
    } catch (err) {
      toast.error('Perbarui gagal')
      setRefreshResult({ error: err.message })
    } finally {
      setRefreshing(false)
    }
  }

  const handleDisconnectToggle = async () => {
    if (!deviceOffline && !window.confirm('Putuskan koneksi perangkat? Polling dijeda sampai dihubungkan kembali.')) {
      return
    }
    setDisconnecting(true)
    try {
      if (deviceOffline) {
        const result = await settingsAPI.reconnect()
        setRefreshResult(result?.data)
        toast.success('Perangkat terhubung kembali')
      } else {
        await settingsAPI.disconnectFingerprint()
        toast.success('Koneksi perangkat diputus')
      }
      await queryClient.invalidateQueries(['settings'])
    } catch (err) {
      toast.error('Gagal mengubah status koneksi')
    } finally {
      setDisconnecting(false)
    }
  }

  const Dot = ({ on, tone }) => (
    <span className={`inline-block w-2 h-2 rounded-full ${on ? tone : 'bg-base-300'}`} />
  )

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl p-6 space-y-5">
      <h2 className="font-semibold">Kontrol perangkat</h2>

      {/* Polling toggle */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Monitoring polling</span>
          <span className={`badge badge-sm ${pollEnabled ? 'badge-success' : 'badge-error'}`}>
            {pollEnabled ? 'AKTIF' : 'NONAKTIF'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-base-content/50">Baca log device secara berkala</span>
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-success"
            checked={pollEnabled}
            disabled={togglePolling.isPending}
            onChange={(e) => togglePolling.mutate(e.target.checked)}
          />
        </div>
        {pollEnabled && device.inSchedule === false && (
          <p className="text-xs text-warning">Di luar jam jadwal — polling menunggu jam aktif.</p>
        )}
      </div>

      {/* Schedule mode */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Gunakan jadwal polling</span>
          <span className={`badge badge-sm ${scheduleEnabled ? 'badge-info' : 'badge-ghost'}`}>
            {scheduleEnabled ? 'AKTIF' : 'NONAKTIF'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-base-content/50">
            {device.activeSchedules || 0} jadwal aktif · kelola di halaman Jadwal
          </span>
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-info"
            checked={scheduleEnabled}
            disabled={toggleSchedule.isPending}
            onChange={(e) => toggleSchedule.mutate(e.target.checked)}
          />
        </div>
      </div>

      <div className="border-t border-base-300 pt-5 space-y-3">
        {deviceOffline && (
          <p className="text-xs rounded-lg bg-warning/10 text-warning px-3 py-2">
            Perangkat {device.manualDisconnected ? 'diputus manual — polling dijeda' : 'tidak terhubung — polling mencoba koneksi'}
          </p>
        )}

        <button
          className={`btn btn-sm ${deviceOffline ? 'btn-success' : 'btn-outline btn-error'} w-full`}
          onClick={handleDisconnectToggle}
          disabled={disconnecting}
        >
          {disconnecting && <span className="loading loading-spinner loading-xs"></span>}
          {deviceOffline ? 'Hubungkan' : 'Putuskan koneksi'}
        </button>

        <button
          className="btn btn-sm btn-primary w-full"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing && <span className="loading loading-spinner loading-xs"></span>}
          Perbarui koneksi
        </button>

        {refreshResult && !refreshResult.error && (
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-base-content/70">Fingerprint</span>
              <span className={refreshResult.fingerprint?.success ? 'text-success' : 'text-error'}>
                {refreshResult.fingerprint?.success ? `Terhubung · ${refreshResult.fingerprint.logsFound || 0} catatan` : 'Gagal'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-base-content/70">WAHA</span>
              <span className={refreshResult.waha?.connected ? 'text-success' : 'text-error'}>
                {refreshResult.waha?.connected ? 'Terhubung' : 'Offline'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Live status */}
      <div className="border-t border-base-300 pt-5 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-base-content/70">
            <Dot on={device.deviceOnline} tone="bg-success" /> Perangkat
          </span>
          <span className={device.deviceOnline ? 'text-success' : 'text-error'}>
            {device.deviceOnline ? 'Terhubung' : 'Terputus'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-base-content/70">
            <Dot on={waha.connected} tone="bg-success" /> WhatsApp API
          </span>
          <span className={waha.connected ? 'text-success' : 'text-error'}>
            {waha.connected ? 'Terhubung' : 'Offline'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-base-content/70">Polling terakhir</span>
          <span className="tabular-nums text-base-content/80">
            {device.lastPollTime
              ? new Date(device.lastPollTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}