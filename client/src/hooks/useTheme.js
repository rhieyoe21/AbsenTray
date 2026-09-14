import { useState, useEffect } from 'react'
import useThemeStore from '../store/themeStore'

export default function useTheme() {
  const { theme, setTheme } = useThemeStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
  }

  return {
    theme,
    toggleTheme,
    isDark: theme === 'dark',
    mounted
  }
}