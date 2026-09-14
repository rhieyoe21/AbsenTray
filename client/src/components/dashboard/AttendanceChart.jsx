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
        secondary: 'rgba(52, 211, 153, 0.8)',
        accent: 'rgba(252, 211, 77, 0.8)',
        border: 'rgba(96, 165, 250, 1)'
      }
    : {
        primary: 'rgba(59, 130, 246, 0.8)',
        secondary: 'rgba(16, 185, 129, 0.8)',
        accent: 'rgba(245, 158, 11, 0.8)',
        border: 'rgba(59, 130, 246, 1)'
      }

  const hourlyData = chartData?.data?.hourly || { labels: [], datasets: [] }
  const byModeData = chartData?.data?.byMode || { labels: [], datasets: [] }

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Attendance by Hour',
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
        ticks: { color: isDark ? '#9ca3af' : '#6b7280' },
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
        text: 'Distribution by Mode (Masuk/Pulang)',
        color: isDark ? '#f9fafb' : '#1f2937',
        font: { size: 16, weight: 'bold' }
      }
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Hourly Bar Chart */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="h-72">
            <Bar
              data={{
                labels: hourlyData.labels,
                datasets: [{
                  label: 'Attendance Count',
                  data: hourlyData.datasets[0]?.data || [],
                  backgroundColor: chartColors.primary,
                  borderColor: chartColors.border,
                  borderWidth: 2,
                  borderRadius: 6
                }]
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
                    chartColors.secondary,  // Masuk (green)
                    chartColors.accent,     // Pulang (yellow)
                    chartColors.primary,    // Lainnya (blue)
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