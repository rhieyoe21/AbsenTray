import React, { useState, useRef } from 'react'
import { PencilSquareIcon, TrashIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { usersAPI } from '../services/api'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../utils/constants'
import LoadingSpinner from '../components/common/LoadingSpinner'

const UserForm = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    uid: user?.uid || '',
    name: user?.name || '',
    whatsapp_number: user?.whatsapp_number || ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.uid || !formData.name || !formData.whatsapp_number) {
      toast.error('All fields are required')
      return
    }
    
    // Validate WhatsApp number format
    const cleanNumber = formData.whatsapp_number.replace(/\D/g, '')
    if (!cleanNumber.startsWith('62') && !cleanNumber.startsWith('628')) {
      toast.error('WhatsApp number should start with 62 (e.g., 6281234567890)')
      return
    }
    
    try {
      setIsSubmitting(true)
      
      if (user) {
        await usersAPI.update(user.uid, {
          name: formData.name,
          whatsapp_number: cleanNumber
        })
        toast.success('User updated successfully')
      } else {
        await usersAPI.create({
          uid: formData.uid,
          name: formData.name,
          whatsapp_number: cleanNumber
        })
        toast.success('User created successfully')
      }
      
      onSave()
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to save user')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg text-center">
          {user ? 'Edit User' : 'Add New User'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">UID (Fingerprint ID)</span>
            </label>
            <input
              type="text"
              name="uid"
              className="input input-bordered"
              placeholder="e.g., 827305001"
              value={formData.uid}
              onChange={handleChange}
              disabled={!!user} // Can't change UID for existing user
              required
            />
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Name</span>
            </label>
            <input
              type="text"
              name="name"
              className="input input-bordered"
              placeholder="e.g., ABDUS SYUKUR"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">WhatsApp Number</span>
            </label>
            <input
              type="text"
              name="whatsapp_number"
              className="input input-bordered"
              placeholder="e.g., 628XXXXXXXXXX"
              value={formData.whatsapp_number}
              onChange={handleChange}
              required
            />
            <label className="label">
              <span className="label-text-alt">Use international format with country code (62 for Indonesia)</span>
            </label>
          </div>
          
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isSubmitting}
            >
              {isSubmitting && <span className="loading loading-spinner loading-xs"></span>}
              {user ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Users() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [deletingUser, setDeletingUser] = useState(null)
  
  const queryClient = useQueryClient()
  
  const { data, isLoading } = useQuery({
    queryKey: ['users', search, page, pageSize],
    queryFn: () => usersAPI.getAll({ search, limit: pageSize, offset: page * pageSize }),
  })

  const deleteMutation = useMutation({
    mutationFn: (uid) => usersAPI.delete(uid),
    onSuccess: () => {
      toast.success('User deleted')
      queryClient.invalidateQueries(['users'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete user')
    }
  })

  const handleSearch = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    setSearch(formData.get('search') || '')
    setPage(0)
  }

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  const handleExportCSV = async () => {
    try {
      const blob = await usersAPI.exportCSV()
      downloadBlob(blob, `karyawan_export_${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success('Karyawan diekspor ke CSV')
    } catch (error) {
      toast.error('Gagal mengekspor karyawan')
    }
  }

  const handleExportExcel = async () => {
    try {
      const blob = await usersAPI.exportXLSX()
      downloadBlob(blob, `karyawan_export_${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success('Karyawan diekspor ke file Excel (.xlsx)')
    } catch (error) {
      toast.error('Gagal mengekspor karyawan')
    }
  }

  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const importFileRef = useRef(null)

  const handleDownloadTemplate = () => {
    const csv = 'uid,name,wa\n827305001,NAMA GURU,628XXXXXXXXXX\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    downloadBlob(blob, 'template_guru.csv')
    toast.success('Template CSV diunduh')
  }

  const handleImport = async () => {
    const file = importFileRef.current?.files?.[0]
    if (!file) {
      toast.error('Pilih file CSV/Excel terlebih dahulu')
      return
    }
    setImporting(true)
    setImportResult(null)
    try {
      const res = await usersAPI.import(file)
      setImportResult(res?.data)
      queryClient.invalidateQueries(['users'])
      queryClient.invalidateQueries(['users-all'])
      toast.success(`${res.data.imported} guru diimpor`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal impor file')
    } finally {
      setImporting(false)
      if (importFileRef.current) importFileRef.current.value = ''
    }
  }

  if (isLoading) return <LoadingSpinner />

  const users = data?.data || []
  const total = data?.pagination?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="mb-6">
          <h1 className="text-2xl font-semibold">Guru</h1>
          <p className="text-sm text-base-content/60">Daftar Guru dan nomor WhatsApp penerima notifikasi.</p>
        </header>

      {/* Actions */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex flex-wrap gap-2 justify-between items-center">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                name="search"
                className="input input-bordered input-sm w-64"
                placeholder="Search by name, UID, or WhatsApp..."
                defaultValue={search}
              />
              <button type="submit" className="btn btn-sm btn-primary">
                Search
              </button>
            </form>
            
{/* Action buttons */}
            <div className="flex flex-wrap gap-2 items-center">
              {/* Export dropdown */}
              <div className="dropdown dropdown-end">
                <button tabIndex={0} className="btn btn-sm btn-outline">
                  <ArrowUpTrayIcon className="w-4 h-4" />
                  Ekspor
                </button>
                <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-44">
                  <li>
                    <button onClick={handleExportCSV}>Ekspor CSV</button>
                  </li>
                  <li>
                    <button onClick={handleExportExcel}>Ekspor Excel (.xlsx)</button>
                  </li>
                </ul>
              </div>

              <button className="btn btn-sm btn-outline btn-info" onClick={() => { setImportResult(null); setShowImport(true) }}>
                <ArrowDownTrayIcon className="w-4 h-4" />
                Impor CSV/Excel
              </button>

              <button 
                className="btn btn-sm btn-success"
                onClick={() => setShowCreateModal(true)}
              >
                Tambah Guru
              </button>
            </div>
          </div>

          {/* Users table */}
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>#</th>
                  <th>UID</th>
                  <th>Name</th>
                  <th>WhatsApp</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-base-content/50">
                      No users found{search ? ' matching "' + search + '"' : ''}
                    </td>
                  </tr>
                ) : (
                  users.map((user, index) => (
                    <tr key={user.uid} className="hover">
                      <td>{page * pageSize + index + 1}</td>
                      <td className="font-mono text-xs">{user.uid}</td>
                      <td className="font-medium">{user.name}</td>
                      <td className="font-mono text-xs">{user.whatsapp_number}</td>
                      <td className="text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            className="btn btn-xs btn-ghost"
                            onClick={() => setEditingUser(user)}
                          >
                            Ubah
                          </button>
                          <button
                            className="btn btn-xs btn-ghost text-error"
                            onClick={() => setDeletingUser(user)}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap justify-between items-center mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm opacity-75">Tampil:</span>
              <select
                className="select select-sm select-bordered"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0) }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <span className="text-sm opacity-75">
                {total} Guru
              </span>
            </div>
            
            <div className="join">
              <button
                className="join-item btn btn-sm"
                onClick={() => setPage(0)}
                disabled={page <= 0}
              >
                «
              </button>
              <button
                className="join-item btn btn-sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page <= 0}
              >
                ‹
              </button>
              <button className="join-item btn btn-sm btn-disabled">
                Halaman {page + 1} dari {totalPages}
              </button>
              <button
                className="join-item btn btn-sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                ›
              </button>
              <button
                className="join-item btn btn-sm"
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
              >
                »
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Impor Guru</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(false)}>Tutup</button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-base-200 p-3">
                <span className="text-sm text-base-content/70">Belum punya format yang benar?</span>
                <button className="btn btn-sm btn-outline" onClick={handleDownloadTemplate}>
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Unduh Template
                </button>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text font-medium">Pilih file CSV / Excel (.csv, .xlsx)</span></label>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="file-input file-input-bordered file-input-sm w-full"
                />
                <label className="label"><span className="label-text-alt">Kolom: uid,name,wa — format otomatis terdeteksi (CSV atau Excel).</span></label>
              </div>

              <button className="btn btn-primary w-full" onClick={handleImport} disabled={importing}>
                {importing && <span className="loading loading-spinner loading-xs"></span>}
                Impor Sekarang
              </button>

              {importResult && (
                <div className="rounded-xl border border-base-300 bg-base-200/50 p-4 text-sm">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-xl font-semibold text-success">{importResult.imported}</div>
                      <div className="text-xs text-base-content/60">Diimpor</div>
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-warning">{importResult.skipped}</div>
                      <div className="text-xs text-base-content/60">Dilewati</div>
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-error">{importResult.errors}</div>
                      <div className="text-xs text-base-content/60">Gagal</div>
                    </div>
                  </div>
                  {importResult.skippedReasons?.length > 0 && (
                    <ul className="mt-3 space-y-1 list-disc list-inside text-xs text-base-content/70">
                      {importResult.skippedReasons.slice(0, 5).map((s, i) => (
                        <li key={i}>{s.uid ? `UID ${s.uid} — ${s.reason}` : s.reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <UserForm
          onClose={() => setShowCreateModal(false)}
          onSave={() => queryClient.invalidateQueries(['users'])}
        />
      )}

      {/* Edit Modal */}
      {editingUser && (
        <UserForm
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={() => queryClient.invalidateQueries(['users'])}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-center">Hapus User</h3>
            <p className="py-4 text-center">
              Are you sure you want to delete <strong>{deletingUser.name}</strong> ({deletingUser.uid})?
              <br />
              <span className="text-error text-sm">This action cannot be undone.</span>
            </p>
            <div className="modal-action justify-center">
              <button className="btn btn-ghost" onClick={() => setDeletingUser(null)}>
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={() => {
                  deleteMutation.mutate(deletingUser.uid)
                  setDeletingUser(null)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}