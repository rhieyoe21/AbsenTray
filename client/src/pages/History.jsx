import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { attendanceAPI, usersAPI } from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../utils/constants'

const StatusBadge = ({ status }) => {
  const styles = {
    sent: 'badge-success',
    pending: 'badge-warning',
    failed: 'badge-error',
    retrying: 'badge-info'
  }
  const labels = {
    sent: 'Terkirim',
    pending: 'Belum Terkirim',
    failed: 'Gagal',
    retrying: 'Retry'
  }
  return (
    <span className={`badge badge-sm ${styles[status] || 'badge-neutral'}`}>
      {labels[status] || status}
    </span>
  )
}

const fmtDT = (t) => {
  try {
    return new Date(String(t).replace(' ', 'T')).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  } catch {
    return '—'
  }
}

export default function History() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [filterDate, setFilterDate] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [sendingId, setSendingId] = useState(null)

  const { data: userList } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => usersAPI.getAll({ limit: 10000, offset: 0 }),
    staleTime: 60_000
  })

  const params = {
    limit: pageSize,
    offset: page * pageSize
  }
  if (filterDate) params.date = filterDate
  if (filterStatus) params.status = filterStatus
  if (filterUser) params.userId = filterUser

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-history', filterDate, filterStatus, filterUser, page, pageSize],
    queryFn: () => attendanceAPI.getAll(params)
  })

  const resendMutation = useMutation({
    mutationFn: (id) => attendanceAPI.resend(id),
    onSuccess: (res) => {
      toast.success(res.data.status === 'sent' ? 'Pesan absen terkirim' : 'Pesan dikirim ulang')
      queryClient.invalidateQueries(['attendance-history'])
      queryClient.invalidateQueries(['dashboard-stats'])
      queryClient.invalidateQueries(['recent-activities'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Gagal mengirim pesan')
    }
  })

  const handleSend = async (id) => {
    setSendingId(id)
    try {
      await resendMutation.mutateAsync(id)
    } finally {
      setSendingId(null)
    }
  }

  if (isLoading) return <LoadingSpinner />

  const records = data?.data || []
  const total = data?.pagination?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6">
      <header className="mb-6">
          <h1 className="text-2xl font-semibold">Riwayat Absen</h1>
          <p className="text-sm text-base-content/60">Catatan kehadiran beserta status pengiriman pesan. Kirim ulang per baris bila perlu.</p>
        </header>

      {/* Filters */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex flex-wrap gap-2 items-end justify-between">
            <div className="flex flex-wrap gap-2">
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Tanggal</span></label>
                <input
                  type="date"
                  className="input input-bordered input-sm"
                  value={filterDate}
                  onChange={(e) => { setFilterDate(e.target.value); setPage(0) }}
                />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Karyawan</span></label>
                <select
                  className="select select-bordered select-sm"
                  value={filterUser}
                  onChange={(e) => { setFilterUser(e.target.value); setPage(0) }}
                >
                  <option value="">Semua karyawan</option>
                  {(userList?.data || []).map((u) => (
                    <option key={u.uid} value={u.uid}>{u.name} — {u.uid}</option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Status</span></label>
                <select
                  className="select select-bordered select-sm"
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(0) }}
                >
                  <option value="">Semua</option>
                  <option value="sent">Terkirim (sent)</option>
                  <option value="pending">Belum Terkirim</option>
                  <option value="failed">Gagal</option>
                  <option value="retrying">Retry</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm opacity-75">Tampil:</span>
              <select
                className="select select-sm select-bordered"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0) }}
              >
                {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Waktu</th>
                  <th>Nama</th>
                  <th>UID</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-base-content/50">
                      Tidak ada data absen
                    </td>
                  </tr>
                ) : (
                  records.map((rec, i) => (
                    <tr key={rec.id} className="hover">
                      <td>{page * pageSize + i + 1}</td>
                      <td className="text-xs font-mono">{fmtDT(rec.attendance_time)}</td>
                      <td className="font-medium">{rec.user_name}</td>
                      <td className="font-mono text-xs">{rec.user_id}</td>
                      <td>
                        <span className={`badge badge-sm ${rec.mode === 'Masuk' ? 'badge-success' : 'badge-warning'}`}>
                          {rec.mode === 'Masuk' ? 'Masuk' : 'Pulang'}
                        </span>
                      </td>
                      <td><StatusBadge status={rec.status} /></td>
                      <td className="text-right">
                        <button
                          className={`btn btn-xs ${rec.status === 'sent' ? 'btn-outline' : 'btn-primary'}`}
                          disabled={sendingId === rec.id || resendMutation.isPending}
                          onClick={() => handleSend(rec.id)}
                        >
                          {sendingId === rec.id ? (
                            <span className="loading loading-spinner loading-xs"></span>
                          ) : rec.status === 'sent' ? (
                            'Kirim ulang'
                          ) : (
                            'Kirim'
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap justify-between items-center p-4">
            <span className="text-sm opacity-75">{total} record</span>
            <div className="join">
              <button className="join-item btn btn-sm" onClick={() => setPage(0)} disabled={page <= 0}>«</button>
              <button className="join-item btn btn-sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0}>‹</button>
              <button className="join-item btn btn-sm btn-disabled">Halaman {page + 1} / {totalPages}</button>
              <button className="join-item btn btn-sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>›</button>
              <button className="join-item btn btn-sm" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>»</button>
            </div>
          </div>
        </div>
      </div>

      <div className="alert alert-info">
        <div>
          <h3 className="font-bold text-sm">ℹ️ Catatan</h3>
          <p className="text-sm">
            Pesan absen otomatis hanya dikirim untuk absensi <strong>hari ini</strong>. Catatan lama (riwayat)
            tersimpan sebagai <i>Belum Terkirim</i> sampai Anda menekan <strong>Kirim</strong> secara manual.
          </p>
        </div>
      </div>
    </div>
  )
}