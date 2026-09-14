import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { dashboardAPI, settingsAPI } from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'
import AttendanceChart from '../components/dashboard/AttendanceChart'
import RecentActivity from '../components/dashboard/RecentActivity'
import ControlPanel from '../components/dashboard/ControlPanel'
import { useWebSocket } from '../hooks/useWebSocket'

const WEEKDAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  const date = `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`
  return (
    <div className="text-left select-none">
      <div className="text-5xl sm:text-6xl font-semibold tracking-tight tabular-nums leading-none">
        {h}:{m}:<span className="text-base-content/40">{s}</span>
      </div>
      <div className="text-sm font-bold text-base-content/60 mt-2">{date}</div>
    </div>
  )
}

function StatusLine({ label, on, sub, actionLabel, onAction, busy }) {
  return (
    <div className="flex items-center gap-3 px-3">
      <span className={`w-2.5 h-2.5 rounded-full ${on ? 'bg-success' : 'bg-error'}`} />
      <div className="min-w-0">
        <div className="text-sm font-medium leading-tight">{label}</div>
        <div className="text-xs text-base-content/50 truncate">{sub}</div>
      </div>
      <button
        className="ml-2 btn btn-xs btn-ghost border border-base-300 shrink-0"
        onClick={onAction}
        disabled={busy}
        title={actionLabel}
      >
        {busy && <span className="loading loading-spinner loading-xs"></span>}
        {actionLabel}
      </button>
    </div>
  )
}

const MetricCard = ({ label, value, tone = 'default', hint }) => {
  const tones = {
    default: 'text-base-content',
    success: 'text-success',
    warning: 'text-warning',
    info: 'text-info',
    error: 'text-error'
  }
  return (
    <div className="bg-base-100 border border-base-300 rounded-xl px-5 py-4 flex flex-col gap-1">
      <span className="text-xs text-base-content/60">{label}</span>
      <span className={`text-3xl font-semibold tabular-nums ${tones[tone]}`}>{value}</span>
      {hint && <span className="text-xs text-base-content/40">{hint}</span>}
    </div>
  )
}

export default function Dashboard() {
  const { isConnected } = useWebSocket()
  const queryClient = useQueryClient()
  const [busyDevice, setBusyDevice] = useState(false)
  const [busyWaha, setBusyWaha] = useState(false)

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardAPI.getStats(),
    refetchInterval: 30000
  })

  const handleDeviceAction = async () => {
    setBusyDevice(true)
    try {
      const r = await settingsAPI.reconnect()
      if (r.data?.fingerprint?.success) toast.success('Perangkat terhubung kembali')
      else toast.error('Gagal menghubungkan perangkat')
      queryClient.invalidateQueries(['dashboard-stats'])
      queryClient.invalidateQueries(['settings'])
    } catch {
      toast.error('Gagal memperbarui koneksi perangkat')
    } finally {
      setBusyDevice(false)
    }
  }

  const handleWahaAction = async () => {
    setBusyWaha(true)
    try {
      const r = await settingsAPI.testWaha()
      toast.success(r.success ? 'WhatsApp API terhubung' : 'WhatsApp API tidak merespons')
      queryClient.invalidateQueries(['dashboard-stats'])
      queryClient.invalidateQueries(['settings'])
    } catch {
      toast.error('Gagal memperbarui koneksi WhatsApp API')
    } finally {
      setBusyWaha(false)
    }
  }

  if (isLoading) return <LoadingSpinner />

  const device = stats?.data?.device || {}
  const waha = stats?.data?.waha || {}
  const morning = stats?.data?.attendance?.byMode?.find(m => m.mode === 'Masuk')?.count || 0
  const evening = stats?.data?.attendance?.byMode?.find(m => m.mode === 'Pulang')?.count || 0
  const total = stats?.data?.attendance?.total || 0
  const pending = stats?.data?.attendance?.byStatus?.find(s => s.status === 'pending')?.count || 0
  const failed = stats?.data?.attendance?.byStatus?.find(s => s.status === 'failed')?.count || 0

  const deviceOn = device.deviceOnline && !device.manualDisconnected

  return (
    <div className="space-y-8">
      {/* Hero: device/WA status + live clock */}
      <div className="pb-6 border-b border-base-300">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-end">
          <div className="space-y-2.5">
            <StatusLine
              label="Perangkat fingerprint"
              on={deviceOn}
              sub={deviceOn ? 'Terhubung' : device.manualDisconnected ? 'Dijeda manual' : 'Tidak terhubung'}
              actionLabel={deviceOn ? 'Perbarui' : 'Hubungkan'}
              onAction={handleDeviceAction}
              busy={busyDevice}
            />
            <StatusLine
              label="WhatsApp API"
              on={waha.connected}
              sub={waha.connected ? 'Terhubung' : 'Offline'}
              actionLabel="Perbarui"
              onAction={handleWahaAction}
              busy={busyWaha}
            />
            
          </div>
          <div className="lg:justify-self-end">
            <Clock />
          </div>
        </div>
      </div>

      {/* Today stats */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h1 className="text-xl sm:text-2xl font-semibold">Hari ini</h1>
          <span className="text-sm text-base-content/50 tabular-nums">{total} absensi</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total absensi" value={total} />
          <MetricCard label="Hadir" value={morning} tone="success" />
          <MetricCard label="Pulang" value={evening} tone="warning" />
          <MetricCard
            label="Belum terkirim"
            value={pending}
            tone={pending > 0 ? 'error' : 'default'}
            hint={pending > 0 ? 'Lihat halaman Riwayat' : undefined}
          />
        </div>
      </section>

      {failed > 0 && (
        <div className="rounded-xl border border-error/40 bg-error/5 text-error px-4 py-3 text-sm">
          {failed} pesan gagal terkirim. Kirim ulang lewat halaman Riwayat.
        </div>
      )}

      <AttendanceChart />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-base-100 border border-base-300 rounded-xl overflow-hidden">
          <header className="flex items-center justify-between px-6 pt-5 pb-3">
            <h2 className="font-semibold">Absensi terbaru</h2>
            <span className="text-xs text-base-content/50">tampil 15 baris</span>
          </header>
          <RecentActivity limit={15} />
        </section>

        <ControlPanel />
      </div>
    </div>
  )
}