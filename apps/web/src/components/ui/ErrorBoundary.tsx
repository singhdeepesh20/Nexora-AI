import { Component, type ReactNode } from 'react'

/** Keeps a failing panel from unmounting the whole campus; the student can close it and continue. */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('NEXORA panel error:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="absolute inset-0 z-40 grid place-items-center bg-ink-950/60 p-6" role="alert">
        <div className="glass max-w-md rounded-2xl p-6 text-center">
          <h2 className="font-semibold text-white">This panel hit an unexpected error</h2>
          <p className="mt-2 text-sm text-ink-400">{this.state.error.message}</p>
          <p className="mt-2 text-xs text-ink-400">Your progress is saved. Close the panel to return to the campus.</p>
          <button
            className="mt-4 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink-950"
            onClick={() => {
              this.setState({ error: null })
              this.props.onReset?.()
            }}
          >
            Close panel
          </button>
        </div>
      </div>
    )
  }
}
