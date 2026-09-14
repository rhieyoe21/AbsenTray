import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
          <div className="card bg-base-100 shadow-xl max-w-md w-full">
            <div className="card-body items-center text-center">
              <div className="text-5xl mb-2">😵</div>
              <h2 className="card-title">Terjadi Kesalahan</h2>
              <p className="text-sm opacity-75">
                Halaman ini gagal dimuat. Silakan muat ulang.
              </p>
              <pre className="text-xs bg-base-200 p-3 rounded-lg w-full overflow-auto text-left whitespace-pre-wrap max-h-40">
                {this.state.error?.message || 'Unknown error'}
              </pre>
              <div className="card-actions mt-2">
                <button className="btn btn-primary" onClick={this.handleReset}>
                  Muat ulang halaman
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}