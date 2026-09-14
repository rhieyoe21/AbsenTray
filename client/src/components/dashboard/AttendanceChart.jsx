import React from 'react'
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar, Pie } from 'react-chartjs-2'
import { useQuery } from '@tanstack/react-query'
import { dashboardAPI } from '../../services/api'
import useTheme from '../../hooks/useTheme'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function AttendanceChart() {
  const { isDark } = useTheme()
  
  const { data: chartData, isLoading } = useQuery({
    queryKey: ['attendance-chart'],
    queryFn: () => dashboardAPI.getCharts(),
    refetchInterval: 30000
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  const chartColors = isDark
    ? {
        primary: 'rgba(96, 165, 250, 0.8)',
        success: 'rgba(74, 222, 128, 0.85)',
        warning: 'rgba(251, 191, 36, 0.85)',
        border: 'rgba(96, 165, 250, 1)'
      }
    : {
        primary: 'rgba(59, 130, 246, 0.8)',
        success: 'rgba(21, 128, 61, 0.8)',
        warning: 'rgba(161, 98, 7, 0.8)',
        border: 'rgba(59, 130, 246, 1)'
      }

  const tenMinutes = chartData?.data?.tenMinutes || { labels: [], datasets: [] }
  const byModeData = chartData?.data?.byMode || { labels: [], datasets: [] }
  const masukSeries = tenMinutes.datasets?.find((d) => d.label === 'Masuk')?.data || []
  const pulangSeries = tenMinutes.datasets?.find((d) => d.label === 'Pulang')?.data || []

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        labels: { color: isDark ? '#f9fafb' : '#1f2937', boxWidth: 14 }
      },
      title: {
        display: true,
        text: 'Absensi tiap 10 menit — Masuk vs Pulang',
        color: isDark ? '#f9fafb' : '#1f2937',
        font: { size: 16, weight: 'bold' }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: isDark ? '#9ca3af' : '#6b7280' },
        grid: { color: isDark ? 'rgba(156, 163, 175, 0.2)' : 'rgba(107, 114, 128, 0.2)' }
      },
      x: {
        ticks: {
          color: isDark ? '#9ca3af' : '#6b7280',
          maxRotation: 0,
          // Tampilkan semua label (per 10 menit) kecuali terlalu banyak.
          autoSkip: tenMinutes.labels.length > 50,
          maxTicksLimit: tenMinutes.labels.length > 50 ? 25 : undefined,
          callback: (value) => tenMinutes.labels[value] || ''
        },
        grid: { display: false }
      }
    }
  }

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: isDark ? '#f9fafb' : '#1f2937' }
      },
      title: {
        display: true,
        text: 'Sebaran Masuk/Pulang',
        color: isDark ? '#f9fafb' : '#1f2937',
        font: { size: 16, weight: 'bold' }
      }
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 10-minute bar chart — Masuk vs Pulang */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="h-72">
            <Bar
              data={{
                labels: tenMinutes.labels,
                datasets: [
                  {
                    label: 'Masuk',
                    data: masukSeries,
                    backgroundColor: chartColors.success,
                    borderColor: chartColors.success,
                    borderWidth: 4,
                    borderRadius: 2
                  },
                  {
                    label: 'Pulang',
                    data: pulangSeries,
                    backgroundColor: chartColors.warning,
                    borderColor: chartColors.warning,
                    borderWidth: 4,
                    borderRadius: 2
                  }
                ]
              }}
              options={barOptions}
            />
          </div>
        </div>
      </div>

      {/* Mode Pie Chart */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="h-72">
            <Pie
              data={{
                labels: byModeData.labels,
                datasets: [{
                  data: byModeData.datasets[0]?.data || [],
                  backgroundColor: [
                    chartColors.success,  // Masuk (green)
                    chartColors.warning,  // Pulang (amber)
                    chartColors.primary,  // Lainnya (blue)
                  ],
                  borderWidth: 2
                }]
              }}
              options={pieOptions}
            />
          </div>
        </div>
      </div>
    </div>
  )
}