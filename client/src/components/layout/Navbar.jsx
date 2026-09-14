import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Squares2X2Icon,
  UsersIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CalendarDaysIcon,
  SignalIcon,
  Cog6ToothIcon,
  SunIcon,
  MoonIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import useThemeStore from '../../store/themeStore'

export default function Navbar() {
  const { theme, toggleTheme } = useThemeStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = [
    { path: '/', label: 'Ringkasan', icon: Squares2X2Icon },
    { path: '/users', label: 'Guru', icon: UsersIcon },
    { path: '/templates', label: 'Template', icon: ChatBubbleLeftRightIcon },
    { path: '/history', label: 'Riwayat', icon: ClockIcon },
    { path: '/schedule', label: 'Jadwal', icon: CalendarDaysIcon },
    { path: '/monitoring', label: 'Pemantauan', icon: SignalIcon },
    { path: '/settings', label: 'Pengaturan', icon: Cog6ToothIcon }
  ]

  const isActive = (path) => location.pathname === path

  const NavLink = ({ item, onClick }) => {
    const Icon = item.icon
    return (
      <button
        onClick={() => { navigate(item.path); if (onClick) onClick() }}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive(item.path)
            ? 'bg-primary/10 text-primary'
            : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
        }`}
        aria-current={isActive(item.path) ? 'page' : undefined}
      >
        <Icon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
        {item.label}
      </button>
    )
  }

  const Brand = (
    <div className="flex items-center gap-2.5">
      <span className="w-8 h-8 rounded-lg bg-primary text-primary-content grid place-items-center font-bold text-sm">
        AT
      </span>
      <div className="leading-tight">
        <div className="font-semibold text-base">AbsenTray</div>
        <div className="text-[11px] text-base-content/50">Monitoring absensi</div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 bg-base-100 border-b border-base-300 px-4 py-3 flex items-center justify-between">
        {Brand}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="btn btn-ghost btn-circle"
            title={theme === 'light' ? 'Mode gelap' : 'Mode terang'}
          >
            {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
          </button>
          {mobileOpen ? (
            <button onClick={() => setMobileOpen(false)} className="btn btn-ghost btn-circle">
              <XMarkIcon className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={() => setMobileOpen(true)} className="btn btn-ghost btn-circle">
              <Bars3Icon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden px-4 pb-4 bg-base-100 border-b border-base-300 space-y-1">
          {navItems.map((item) => <NavLink key={item.path} item={item} onClick={() => setMobileOpen(false)} />)}
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 bg-base-100 border-r border-base-300 p-4">
        {Brand}

        <nav className="mt-8 space-y-1" aria-label="Navigasi utama">
          {navItems.map((item) => <NavLink key={item.path} item={item} />)}
        </nav>

        <div className="mt-auto pt-6">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-base-content/70 hover:bg-base-200"
          >
            {theme === 'light' ? <MoonIcon className="w-5 h-5" strokeWidth={1.75} /> : <SunIcon className="w-5 h-5" strokeWidth={1.75} />}
            {theme === 'light' ? 'Mode gelap' : 'Mode terang'}
          </button>
        </div>
      </aside>
    </>
  )
}