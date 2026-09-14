import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { settingsAPI } from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'

const DAYS = [
  { value: 0, label: 'Min' },
  { value: 1, label: 'Sen' },
  { value: 2, label: 'Sel' },
  { value: 3, label: 'Rab' },
  { value: 4, label: 'Kam' },
  { value: 5, label: 'Jum' },
  { value: 6, label: 'Sab' }
]

const Input = ({ label, name, value, onChange, type = 'text' }) => (
  <div className="form-control">
    <label className="label">
      <span className="label-text font-medium">{label}</span>
    </label>
    <input type={type} name={name} className="input input-bordered" value={value} onChange={onChange} />
  </div>
)

export default function Schedule() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsAPI.get()
  })

  const [scheduleForm, setScheduleForm] = useState({ id: null, days: [1, 2, 3, 4, 5], start_time: '08:00', end_time: '17:00' })
  const [editingSchedule, setEditingSchedule] = useState(null)
  const [savingModes, setSavingModes] = useState(false)

  // Mode ranges form (init from API)
  const [modesForm, setModesForm] = useState(null)

  if (data && !modesForm) {
    const m = data.data?.config?.modes || {}
    setModesForm({
      checkin_start: m.checkin_start || '00:00',
      checkin_end: m.checkin_end || '11:59',
      checkout_start: m.checkout_start || '12:00',
      checkout_end: m.checkout_end || '23:59'
    })
  }

  const deviceStatus = data?.data?.status?.device || {}
  const schedules = data?.data?.schedules || []

  // --- Schedules CRUD ---
  const resetScheduleForm = () =>
    setScheduleForm({ id: null, days: [1, 2, 3, 4, 5], start_time: '08:00', end_time: '17:00' })

  const createSchedule = useMutation({
    mutationFn: (payload) => settingsAPI.schedules.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['settings'])
      toast.success('Jadwal ditambahkan')
      resetScheduleForm()
      setEditingSchedule(null)
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Gagal menambah jadwal')
  })

  const updateSchedule = useMutation({
    mutationFn: ({ id, payload }) => settingsAPI.schedules.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['settings'])
      toast.success('Jadwal diperbarui')
      setEditingSchedule(null)
      resetScheduleForm()
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Gagal memperbarui jadwal')
  })

  const deleteSchedule = useMutation({
    mutationFn: (id) => settingsAPI.schedules.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['settings'])
      toast.success('Jadwal dihapus')
    },
    onError: () => toast.error('Gagal menghapus jadwal')
  })

  const toggleDay = (day) => {
    setScheduleForm((prev) => {
      const has = prev.days.includes(day)
      let days = has ? prev.days.filter((d) => d !== day) : [...prev.days, day].sort()
      if (days.length === 0) days = [day]
      return { ...prev, days }
    })
  }

  const handleScheduleSubmit = () => {
    const { days, start_time, end_time } = scheduleForm
    if (start_time >= end_time) {
      toast.error('Waktu selesai harus setelah waktu mulai')
      return
    }
    if (!days || days.length === 0) {
      toast.error('Pilih minimal satu hari')
      return
    }
    const payload = { days, start_time, end_time, is_active: 1 }
    if (editingSchedule) updateSchedule.mutate({ id: editingSchedule.id, payload })
    else createSchedule.mutate(payload)
  }

  // --- Mode ranges save ---
  const handleModesChange = (e) => {
    const { name, value } = e.target
    setModesForm((prev) => ({ ...prev, [name]: value }))
  }

  const saveModes = async () => {
    setSavingModes(true)
    try {
      await settingsAPI.update({ modes: modesForm })
      queryClient.invalidateQueries(['settings'])
      toast.success('Range jam Masuk/Pulang disimpan')
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Gagal menyimpan range jam')
    } finally {
      setSavingModes(false)
    }
  }

  if (isLoading || !modesForm) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <header className="mb-6">
          <h1 className="text-2xl font-semibold">Jadwal Polling</h1>
          <p className="text-sm text-base-content/60">Jam polling berjalan dan rentang waktu penentuan Masuk/Pulang.</p>
        </header>

      {/* Polling schedule panel */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Jadwal Polling Fingerprint</h2>

          <div className="form-control">
            <label className="label"><span className="label-text font-medium">Mode Jadwal</span></label>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm opacity-75">
                Jika aktif, polling hanya berjalan pada hari/jam terjadwal (tidak 24/7)
              </span>
              <input
                type="checkbox"
                className="toggle toggle-info"
                checked={!!deviceStatus.scheduleEnabled}
                onChange={async (e) => {
                  const enabled = e.target.checked
                  await settingsAPI.setScheduleMode(enabled)
                  queryClient.invalidateQueries(['settings'])
                  toast.success(`Mode jadwal ${enabled ? 'AKTIF' : 'NONAKTIF'}`)
                }}
              />
            </div>
          </div>

          <div className="divider my-2"></div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {schedules.length === 0 ? (
              <p className="text-center text-sm opacity-50 py-4">Belum ada jadwal. Tambahkan di bawah.</p>
            ) : (
              schedules.map((s) => {
                const daysArr = (() => {
                  if (s.days) {
                    try { return JSON.parse(s.days) } catch { return [] }
                  }
                  return s.day_of_week !== null && s.day_of_week !== undefined ? [s.day_of_week] : []
                })()
                const dayLabels = daysArr.map((d) => DAYS.find((x) => x.value === d)?.label).filter(Boolean).join(', ')

                return (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-base-200">
                    <div className="flex flex-col">
                      <span className="text-xs opacity-75">{dayLabels || '—'}</span>
                      <span className="font-mono text-sm">{s.start_time} - {s.end_time}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="btn btn-xs btn-ghost"
                        title="Ubah"
                        onClick={() => {
                          setEditingSchedule(s)
                          setScheduleForm({ id: s.id, days: daysArr.length ? daysArr : [1], start_time: s.start_time, end_time: s.end_time })
                        }}
                      ><PencilSquareIcon className="w-4 h-4" /></button>
                      <button className="btn btn-xs btn-ghost text-error" title="Hapus" onClick={() => deleteSchedule.mutate(s.id)}>
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="divider my-2">Tambah / Edit Jadwal</div>

          <div className="form-control">
            <label className="label"><span className="label-text font-medium">Hari (bisa pilih beberapa)</span></label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  className={`btn btn-sm ${scheduleForm.days.includes(day.value) ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => toggleDay(day.value)}
                >{day.label}</button>
              ))}
            </div>
            <label className="label">
              <span className="label-text-alt">Dipilih: {scheduleForm.days.map((d) => DAYS.find((x) => x.value === d)?.label).join(', ')}</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <Input label="Mulai Polling" name="start_time" type="time" value={scheduleForm.start_time}
              onChange={(e) => setScheduleForm((prev) => ({ ...prev, start_time: e.target.value }))} />
            <Input label="Selesai Polling" name="end_time" type="time" value={scheduleForm.end_time}
              onChange={(e) => setScheduleForm((prev) => ({ ...prev, end_time: e.target.value }))} />
          </div>

          <div className="mt-3 flex gap-2">
            {editingSchedule && (
              <button className="btn btn-ghost" onClick={() => { setEditingSchedule(null); resetScheduleForm() }}>Batal</button>
            )}
            <button className="btn btn-primary flex-1" onClick={handleScheduleSubmit}>
              {editingSchedule ? 'Simpan jadwal' : 'Tambah jadwal'}
            </button>
          </div>
        </div>
      </div>

      {/* Masuk/Pulang hour range panel */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Rentang jam Masuk / Pulang</h2>
          <p className="text-sm opacity-75">
            Penentuan mode absensi dihitung dari jam absen (zona WIB). Dalam range "Masuk" → <b>Masuk</b>;
            dalam range "Pulang" → <b>Pulang</b>; di luar kedua range → fallback sebelum 12:00 = Masuk.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div className="rounded-lg bg-base-200 p-4 space-y-3">
              <h3 className="font-semibold text-success">Masuk</h3>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Mulai" name="checkin_start" type="time" value={modesForm.checkin_start} onChange={handleModesChange} />
                <Input label="Selesai" name="checkin_end" type="time" value={modesForm.checkin_end} onChange={handleModesChange} />
              </div>
            </div>
            <div className="rounded-lg bg-base-200 p-4 space-y-3">
              <h3 className="font-semibold text-warning">Pulang</h3>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Mulai" name="checkout_start" type="time" value={modesForm.checkout_start} onChange={handleModesChange} />
                <Input label="Selesai" name="checkout_end" type="time" value={modesForm.checkout_end} onChange={handleModesChange} />
              </div>
            </div>
          </div>

          <button className="btn btn-primary w-full mt-3" onClick={saveModes} disabled={savingModes}>
            {savingModes && <span className="loading loading-spinner loading-xs"></span>}
            Simpan rentang jam
          </button>
        </div>
      </div>

      <div className="alert alert-info">
        <div>
          <h3 className="font-bold text-sm">ℹ️ Cara Kerja</h3>
          <p className="text-sm">
            Jadwal polling mengatur <i>kapan</i> device di-poll (tidak 24/7 jika aktif).
            Range jam mengatur <i>label</i> Masuk/Pulang dari setiap absen — keduanya disimpan di database, berlaku langsung.
          </p>
        </div>
      </div>
    </div>
  )
}