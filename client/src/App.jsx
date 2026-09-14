import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import useThemeStore from './store/themeStore'
import Layout from './components/layout/Layout'
import ErrorBoundary from './components/common/ErrorBoundary'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Templates from './pages/Templates'
import Monitoring from './pages/Monitoring'
import History from './pages/History'
import Schedule from './pages/Schedule'
import Settings from './pages/Settings'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 1000 * 60, // 1 minute
    },
  },
})

const THEME_ATTR = { light: 'absen', dark: 'absenDark' }

function App() {
  const { theme } = useThemeStore()

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initialTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light')
    
    useThemeStore.setState({ theme: initialTheme })
    document.documentElement.setAttribute('data-theme', THEME_ATTR[initialTheme] || 'absen')
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', THEME_ATTR[theme] || 'absen')
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster
          position="top-right"
          reverseOrder={false}
          gutter={8}
          toastOptions={{
            duration: 4000,
            style: {
              background: 'oklch(var(--b2))',
              color: 'oklch(var(--bc))',
              borderRadius: 'var(--rounded-box)',
            },
          }}
        />
        
        <Layout>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/users" element={<Users />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/history" element={<History />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/monitoring" element={<Monitoring />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </ErrorBoundary>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App