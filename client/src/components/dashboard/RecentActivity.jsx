import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardAPI } from '../../services/api'

const StatusBadge = ({ status }) => {
  const styles = {
    sent: 'badge-success',
    pending: 'badge-warning',
    failed: 'badge-error',
    retrying: 'badge-info'
  }
  const labels = { sent: 'Terkirim', pending: 'Menunggu', failed: 'Gagal', retrying: 'Kirim ulang' }
  
  return (
    <span className={`badge badge-sm ${styles[status] || 'badge-neutral'}`}>
      {labels[status] || status}
    </span>
  )
}

const ModeBadge = ({ mode }) => {
  return (
    <span className={`badge badge-sm ${mode === 'Masuk' ? 'badge-success' : 'badge-warning'}`}>
      {mode}
    </span>
  )
}

export default function RecentActivity({ limit = 10 }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['recent-activities', limit],
    queryFn: () => dashboardAPI.getRecent(limit),
    refetchInterval: 10000
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <span className="loading loading-spinner loading-md"></span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="alert alert-error">
        <span>Failed to load recent activities</span>
      </div>
    )
  }

  const activities = data?.data || []

  if (activities.length === 0) {
    return (
      <div className="text-center text-base-content/50 py-8">
        <p className="text-sm text-base-content/50">Belum ada absensi hari ini.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra w-full">
        <thead>
          <tr>
            <th>#</th>
            <th>Time</th>
            <th>Name</th>
            <th>UID</th>
            <th>Mode</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity, index) => (
            <tr key={activity.id} className="hover">
              <td>{index + 1}</td>
              <td className="font-mono text-xs">
                {new Date(activity.attendance_time).toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </td>
              <td className="font-medium">{activity.user_name}</td>
              <td className="font-mono text-xs">{activity.user_id}</td>
              <td>
                <ModeBadge mode={activity.mode} />
              </td>
              <td>
                <StatusBadge status={activity.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}