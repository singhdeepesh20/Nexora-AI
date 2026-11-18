import { ArrowLeft, X } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useApp } from '../../stores/app'

type Tone = 'primary' | 'ghost' | 'danger' | 'subtle'
const TONES: Record<Tone, string> = {
  primary: 'bg-teal text-ink-950 hover:brightness-110 font-semibold',
  ghost: 'border border-ink-600 text-ink-200 hover:border-teal hover:text-white',
  subtle: 'bg-ink-700 text-ink-200 hover:bg-ink-600',
  danger: 'bg-red-500/90 text-white hover:bg-red-500',
}

export function Button({ tone = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-teal ${TONES[tone]} ${className}`}
    />
  )
}

export function Badge({ children, color = '#2dd4bf' }: { children: ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)` }}>
      {children}
    </span>
  )
}

export function Meter({ value, color = '#2dd4bf', label }: { value: number; color?: string; label?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div className="w-full" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

/** Full-screen panel used for every 2D interface layered over the campus. */
export function Panel({ title, subtitle, accent = '#2dd4bf', children, wide = false, actions }: {
  title: ReactNode; subtitle?: ReactNode; accent?: string; children: ReactNode; wide?: boolean; actions?: ReactNode
}) {
  const { back, closeAll, overlays } = useApp()
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink-950/55 p-3 sm:p-6" onKeyDown={(e) => e.stopPropagation()}>
      <section role="dialog" aria-label={typeof title === 'string' ? title : undefined}
        className={`glass animate-in flex max-h-full w-full flex-col overflow-hidden rounded-2xl shadow-2xl ${wide ? 'max-w-7xl' : 'max-w-4xl'}`}
        style={{ boxShadow: `0 0 0 1px color-mix(in srgb, ${accent} 18%, transparent), 0 30px 80px -20px rgba(0,0,0,.7)` }}>
        <header className="flex items-center gap-3 border-b border-white/5 px-5 py-3.5">
          {overlays.length > 1 && (
            <button onClick={back} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-700 hover:text-white" aria-label="Back">
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="h-6 w-1 rounded-full" style={{ background: accent }} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-white">{title}</h2>
            {subtitle && <p className="truncate text-xs text-ink-400">{subtitle}</p>}
          </div>
          {actions}
          <button onClick={closeAll} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-700 hover:text-white" aria-label="Close (Esc)">
            <X size={18} />
          </button>
        </header>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
      </section>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>}
    </label>
  )
}

export const inputCls = 'w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-teal'

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ink-400" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-600 border-t-teal" />
      {label}…
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error instanceof Error ? error.message : String(error)}</p>
}

export const STATUS_COLOR: Record<string, string> = {
  locked: '#6b7a8c', available: '#38bdf8', in_progress: '#facc15', mastered: '#2dd4bf',
}
export const STATUS_LABEL: Record<string, string> = {
  locked: 'Locked', available: 'Available', in_progress: 'In progress', mastered: 'Mastered',
}
