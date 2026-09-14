import React, { useState } from 'react'
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { templatesAPI } from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'

const TemplateEditor = ({ template, onClose, onSave }) => {
  const toArray = (v) =>
    Array.isArray(v) ? v : typeof v === 'string' && v.trim() ? v.split(',').map((x) => x.trim()) : []
  
  const [formData, setFormData] = useState({
    name: template?.name || '',
    content: template?.content || '',
    variables: toArray(template?.variables).join(', ') || ''
  })
  const [preview, setPreview] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handlePreview = async () => {
    try {
      const result = await templatesAPI.preview({
        templateName: formData.name || 'attendance_notification'
      })
      setPreview(result?.data?.rendered || '')
    } catch (error) {
      toast.error('Failed to preview template')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.name || !formData.content) {
      toast.error('Template name and content are required')
      return
    }
    
    try {
      setIsSubmitting(true)
      
      if (template) {
        await templatesAPI.update(template.id, {
          name: formData.name,
          content: formData.content,
          variables: formData.variables
        })
        toast.success('Template updated')
      } else {
        await templatesAPI.create({
          name: formData.name,
          content: formData.content,
          variables: formData.variables
        })
        toast.success('Template created')
      }
      
      onSave()
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to save template')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg text-center">
          {template ? 'Edit Template' : 'Create New Template'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Template Name</span>
            </label>
            <input
              type="text"
              name="name"
              className="input input-bordered"
              placeholder="e.g., attendance_notification"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Message Content</span>
              <span className="label-text-alt">Use {"{variable}"} syntax</span>
            </label>
            <textarea
              name="content"
              className="textarea textarea-bordered font-mono text-sm h-48"
              placeholder={`âœ… *Presensi {mode}*\nNama: {name}\nUID: {uid}\nHari: {date}\nJam: {time}`}
              value={formData.content}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Variables (comma-separated)</span>
            </label>
            <input
              type="text"
              name="variables"
              className="input input-bordered"
              placeholder="name, uid, date, time, mode"
              value={formData.variables}
              onChange={handleChange}
            />
            <label className="label">
              <span className="label-text-alt">Available: name, uid, date, time, mode, ip, datetime, transaction_id</span>
            </label>
          </div>
          
          {/* Preview section */}
          {preview && (
            <div className="alert">
              <div>
                <p className="text-sm text-base-content/50 mb-2">Pratinjau pesan</p>
                <div className="rounded-2xl rounded-tl-md border border-base-300 px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed">
                  {preview}
                </div>
              </div>
            </div>
          )}
          
          <div className="modal-action justify-between">
            <button type="button" className="btn btn-ghost" onClick={handlePreview}>
              Pratinjau
            </button>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Batal
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting && <span className="loading loading-spinner loading-xs"></span>}
                {template ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Templates() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [deletingTemplate, setDeletingTemplate] = useState(null)
  
  const queryClient = useQueryClient()
  
  const { data, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesAPI.getAll(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => templatesAPI.delete(id),
    onSuccess: () => {
      toast.success('Template deleted')
      queryClient.invalidateQueries(['templates'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete template')
    }
  })

  if (isLoading) return <LoadingSpinner />

  const templates = data?.data || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="mb-6">
          <h1 className="text-2xl font-semibold">Template Pesan</h1>
          <p className="text-sm text-base-content/60">Pesan WhatsApp untuk absen, ping, dan peringatan.</p>
        </header>

      {/* Templates Grid */}
      <div className="flex justify-end">
        <button 
          className="btn btn-success"
          onClick={() => setShowCreateModal(true)}
        >
          Buat template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.length === 0 ? (
          <div className="card bg-base-100 shadow-xl md:col-span-2 lg:col-span-3">
            <div className="card-body items-center text-center py-12">
              <p className="text-lg font-medium">Belum ada template</p>
              <p className="text-sm opacity-75">Buat template pertama untuk pesan absen, ping, atau peringatan.</p>
            </div>
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="card-body">
                <div className="flex justify-between items-start">
                  <h2 className="card-title text-lg">
                    {template.name}
                  </h2>
                  <span className={`badge ${template.is_active ? 'badge-success' : 'badge-error'}`}>
                    {template.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <p className="text-sm font-mono bg-base-200 p-3 rounded-lg whitespace-pre-wrap flex-1 max-h-40 overflow-y-auto">
                  {template.content}
                </p>
                
                {template.variables && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(() => {
                      const vars = Array.isArray(template.variables)
                        ? template.variables
                        : String(template.variables || '').split(',').map((v) => v.trim()).filter(Boolean)
                      return vars.map((variable) => (
                        <span key={variable} className="badge badge-outline badge-sm">
                          {"{"}{variable}{"}"}
                        </span>
                      ))
                    })()}
                  </div>
                )}
                
                <div className="card-actions justify-end mt-2">
                  <button
                    className="btn btn-xs btn-ghost"
                    onClick={() => setEditingTemplate(template)}
                  >
                    Ubah
                  </button>
                  <button
                    className="btn btn-xs btn-ghost text-error"
                    onClick={() => setDeletingTemplate(template)}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <TemplateEditor
          onClose={() => setShowCreateModal(false)}
          onSave={() => queryClient.invalidateQueries(['templates'])}
        />
      )}

      {/* Edit Modal */}
      {editingTemplate && (
        <TemplateEditor
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={() => queryClient.invalidateQueries(['templates'])}
        />
      )}

      {/* Delete Confirmation */}
      {deletingTemplate && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-center">Hapus Template</h3>
            <p className="py-4 text-center">
              Are you sure you want to delete <strong>{deletingTemplate.name}</strong>?
            </p>
            <div className="modal-action justify-center">
              <button className="btn btn-ghost" onClick={() => setDeletingTemplate(null)}>
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={() => {
                  deleteMutation.mutate(deletingTemplate.id)
                  setDeletingTemplate(null)
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