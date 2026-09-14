import React from 'react'

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <div className="loading loading-spinner loading-lg"></div>
        <p className="text-lg font-semibold">Loading...</p>
      </div>
    </div>
  )
}
