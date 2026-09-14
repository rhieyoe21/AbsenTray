import React from 'react'
import Navbar from './Navbar'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-base-200 lg:flex">
      <Navbar />
      <main className="flex-1 min-w-0 animate-fade-in">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  )
}