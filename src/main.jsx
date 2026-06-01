import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0B1F4B',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 12, padding: 24,
        }}>
          <div style={{ color: '#EF4444', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600 }}>
            APPLICATION ERROR
          </div>
          <div style={{ color: '#9CA3AF', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, maxWidth: 600, textAlign: 'center', wordBreak: 'break-word' }}>
            {this.state.error.message || String(this.state.error)}
          </div>
          <div style={{ color: '#6B7280', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
            Check the browser console for the full stack trace.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 8, padding: '6px 16px', background: 'rgba(27,108,168,0.3)', border: '1px solid rgba(27,108,168,0.5)', borderRadius: 4, color: '#93C5FD', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
