import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { settingsAPI } from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'

const TABS = [
  { id: 'device', label: 'Perangkat' },
  { id: 'waha', label: 'WhatsApp' },
  { id: 'admin', label: 'Notifikasi Admin' },
  { id: 'test', label: 'Test Whatsapp' }
]

const Panel = ({ title, children }) => (
  <div className="bg-base-100 border border-base-300 rounded-xl p-6">
    <h2 className="font-semibold mb-4">{title}</h2>
    {children}
  </div>
)

const Input = ({ label, name, value, onChange, type = 'text', placeholder, suffix }) => (
  <div className="form-control">
    <label className="label"><span className="label-text font-medium">{label}</span></label>
    <div className="flex gap-2 items-center">
      <input type={type} name={name} className="input input-bordered flex-1" value={value} onChange={onChange} placeholder={placeholder} />
      {suffix && <span className="text-sm opacity-75">{suffix}</span>}
    </div>
  </div>
)

const SaveButton = ({ onClick, loading, label = 'Simpan' }) => (
  <button className="btn btn-primary mt-4 w-full" onClick={onClick} disabled={loading}>
    {loading && <span className="loading loading-spinner loading-xs"></span>}
    {label}
  </button>
)

export default function Settings() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [tab, setTab] = useState('device')

  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: () => settingsAPI.get() })

  const [form, setForm] = useState(null)
  const [busyKey, setBusyKey] = useState(null)
  const [pingNumber, setPingNumber] = useState('')
  const [sendingPing, setSendingPing] = useState(false)

  if (data && !form) {
    const d = data.data
    setForm({
      fingerprint_ip: d.config?.fingerprint?.ip || '',
      fingerprint_port: d.config?.fingerprint?.port || 4370,
      fingerprint_timeout: d.config?.fingerprint?.timeout || 10000,
      polling_interval: d.config?.fingerprint?.pollingInterval || 30000,
      disable_before_read: d.settings?.fingerprint_disable_before_read !== '0',
      waha_url: d.config?.waha?.url || '',
      waha_session: d.config?.waha?.session || 'default',
      waha_api_key: '',
      admin_whatsapp: d.config?.admin?.whatsapp || '',
      max_retry: d.config?.retry?.maxAttempts || 3,
      admin_alerts_enabled: d.settings?.admin_alerts_enabled !== '0',
      waha_delay: d.settings?.waha_message_delay_ms || 2000,
      device_log_retention: d.settings?.device_log_retention_days || 30
    })
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const apply = (payload) => settingsAPI.update(payload)

  const saveDevice = async () => {
    setBusyKey('device')
    try {
      await apply({
        fingerprint: { ip: form.fingerprint_ip, port: parseInt(form.fingerprint_port), timeout: parseInt(form.fingerprint_timeout), pollingInterval: parseInt(form.polling_interval) },
        settings: {
          fingerprint_disable_before_read: form.disable_before_read ? '1' : '0',
          device_log_retention_days: String(parseInt(form.device_log_retention) || 30)
        }
      })
      queryClient.invalidateQueries(['settings'])
      toast.success('Pengaturan perangkat disimpan')
    } catch (e) { toast.error(e.response?.data?.error?.message || 'Gagal simpan') }
    finally { setBusyKey(null) }
  }

  const saveWaha = async () => {
    setBusyKey('waha')
    try {
      await apply({ waha: { url: form.waha_url, session: form.waha_session, ...(form.waha_api_key.trim() ? { apiKey: form.waha_api_key.trim() } : {}) } })
      setForm((prev) => ({ ...prev, waha_api_key: '' }))
      queryClient.invalidateQueries(['settings'])
      toast.success('Pengaturan WhatsApp disimpan')
    } catch (e) { toast.error(e.response?.data?.error?.message || 'Gagal simpan') }
    finally { setBusyKey(null) }
  }

  const saveAdmin = async () => {
    setBusyKey('admin')
    try {
      await apply({
        admin: { whatsapp: form.admin_whatsapp },
        retry: { maxAttempts: parseInt(form.max_retry) },
        settings: {
          waha_message_delay_ms: String(parseInt(form.waha_delay) || 0)
        }
      })
      queryClient.invalidateQueries(['settings'])
      toast.success('Pengaturan admin disimpan')
    } catch (e) { toast.error(e.response?.data?.error?.message || 'Gagal simpan') }
    finally { setBusyKey(null) }
  }

  const toggleAdminAlerts = async (val) => {
    setForm((prev) => ({ ...prev, admin_alerts_enabled: val }))
    try {
      await settingsAPI.setAdminAlerts(val)
      queryClient.invalidateQueries(['settings'])
      toast.success(val ? 'Notifikasi admin aktif' : 'Notifikasi admin nonaktif')
    } catch {
      setForm((prev) => ({ ...prev, admin_alerts_enabled: !val }))
      toast.error('Gagal mengubah notifikasi admin')
    }
  }

  const handlePing = async () => {
    if (!pingNumber.trim()) { toast.error('Masukkan nomor WhatsApp'); return }
    setSendingPing(true)
    try {
      const r = await settingsAPI.pingWaha(pingNumber)
      if (r.success && r.data?.sent) toast.success(`Pesan uji terkirim ke ${r.data.number}`)
      else toast.error(`Pesan uji gagal: ${r.data?.error || 'WhatsApp API tidak merespons'}`)
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal mengirim pesan uji') }
    finally { setSendingPing(false) }
  }

  if (isLoading || !form) return <LoadingSpinner />

  const wahaStatus = data?.data?.status?.waha || {}

  return (
    <div className="space-y-6">
      <header className="mb-2">
        <h1 className="text-2xl font-semibold">Pengaturan</h1>
        <p className="text-sm text-base-content/60">Konfigurasi perangkat, WhatsApp, dan Notifikasi Admin, </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-base-300" role="tablist" aria-label="Pengaturan">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 -mb-px rounded-t-lg text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-base-content/60 hover:text-base-content'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'device' && (
        <Panel title="Perangkat fingerprint">
          <div className="space-y-3">
            <Input label="Alamat IP" name="fingerprint_ip" value={form.fingerprint_ip} onChange={handleChange} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Port" name="fingerprint_port" value={form.fingerprint_port} onChange={handleChange} type="number" />
              <Input label="Timeout (ms)" name="fingerprint_timeout" value={form.fingerprint_timeout} onChange={handleChange} type="number" />
            </div>
            <Input label="Interval polling" name="polling_interval" value={form.polling_interval} onChange={handleChange} type="number" suffix="ms" />
            <div className="form-control pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Tahan device sebelum baca log</div>
                  <p className="text-xs text-base-content/50">Nonaktif jika device lebih stabil dibaca tanpa dikunci.</p>
                </div>
                <input type="checkbox" className="toggle toggle-sm toggle-info" checked={form.disable_before_read}
                  onChange={(e) => setForm((prev) => ({ ...prev, disable_before_read: e.target.checked }))} />
              </div>
            </div>
            <Input label="Hari penghapusan log perangkat (default 30)" name="device_log_retention" value={form.device_log_retention} onChange={handleChange} type="number" suffix="hari" />
            <SaveButton onClick={saveDevice} loading={busyKey === 'device'} label="Simpan perangkat" />
          </div>
        </Panel>
      )}

      {tab === 'waha' && (
        <Panel title="WhatsApp API (WAHA)">
          <div className="space-y-3">
            <Input label="URL WAHA" name="waha_url" value={form.waha_url} onChange={handleChange} />
            <Input label="Nama session" name="waha_session" value={form.waha_session} onChange={handleChange} />
            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Kunci API {wahaStatus.hasApiKey && '(tersimpan)'}</span></label>
              <input type="password" name="waha_api_key" className="input input-bordered" value={form.waha_api_key} onChange={handleChange}
                placeholder={wahaStatus.hasApiKey ? 'Kosongkan jika tidak diubah' : 'Masukkan kunci API'} />
            </div>
            <SaveButton onClick={saveWaha} loading={busyKey === 'waha'} label="Simpan WhatsApp" />
          </div>
        </Panel>
      )}

      {tab === 'admin' && (
        <Panel title="Admin & pengiriman ulang">
          <div className="space-y-3">
            <Input label="Nomor WhatsApp admin" name="admin_whatsapp" value={form.admin_whatsapp} onChange={handleChange} placeholder="cth: 628XXXXXXXXXX" />
            <Input label="Batas percobaan kirim ulang" name="max_retry" value={form.max_retry} onChange={handleChange} type="number" suffix="kali" />
            <Input label="Jeda antar pesan WhatsApp" name="waha_delay" value={form.waha_delay} onChange={handleChange} type="number" suffix="ms" />
            <div className="form-control pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Notifikasi ke admin</div>
                  <p className="text-xs text-base-content/50">Alert perangkat offline, WhatsApp API down, dan kirim ulang gagal.</p>
                </div>
                <span className={`badge badge-sm ${form.admin_alerts_enabled ? 'badge-success' : 'badge-error'}`}>
                  {form.admin_alerts_enabled ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <div className="flex justify-end mt-2">
                <input type="checkbox" className="toggle toggle-sm toggle-success" checked={form.admin_alerts_enabled}
                  onChange={(e) => toggleAdminAlerts(e.target.checked)} />
              </div>
            </div>
            <SaveButton onClick={saveAdmin} loading={busyKey === 'admin'} label="Simpan admin" />
          </div>
        </Panel>
      )}

      {tab === 'test' && (
        <Panel title="Uji koneksi WhatsApp">
          <div className="space-y-3">
            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Nomor tujuan</span></label>
              <input type="text" className="input input-bordered" placeholder="cth: 628XXXXXXXXXX" value={pingNumber}
                onChange={(e) => setPingNumber(e.target.value)} />
              <label className="label"><span className="label-text-alt">Format internasional tanpa 0 di depan. Pesan memakai template <code>ping</code>.</span></label>
            </div>
            <button className={`btn ${sendingPing ? '' : 'btn-primary'} w-full`} onClick={handlePing} disabled={sendingPing}>
              {sendingPing ? <span className="loading loading-spinner loading-xs"></span> : null}
              Test Kirim Pesan
            </button>

            
          </div>
        </Panel>
      )}
    </div>
  )
}