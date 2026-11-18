import type { ReactNode } from 'react'
import { inputCls } from '../ui/primitives'

export function Num({ label, value, onChange, step = 'any', min, max, hint }: {
  label: string; value: number | null | undefined; onChange: (v: number) => void; step?: number | string; min?: number; max?: number; hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-ink-400">{label}</span>
      <input type="number" className={`${inputCls} py-1.5`} value={value ?? ''} step={step} min={min} max={max}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} />
      {hint && <span className="mt-0.5 block text-[10px] text-ink-400">{hint}</span>}
    </label>
  )
}

export function Select<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly (T | [T, string])[]; onChange: (v: T) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-ink-400">{label}</span>
      <select className={`${inputCls} py-1.5`} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o]
          return <option key={v} value={v}>{l}</option>
        })}
      </select>
    </label>
  )
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-200">
      <input type="checkbox" className="accent-teal-400" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  )
}

export function Notes({ items, title = 'Analysis' }: { items: string[]; title?: string }) {
  if (!items.length) return null
  return (
    <div className="rounded-xl border border-sky/30 bg-sky/5 p-3">
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-sky">{title}</h4>
      <ul className="space-y-1.5 text-sm text-ink-200">{items.map((n, i) => <li key={i}>• {n}</li>)}</ul>
    </div>
  )
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-800/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-400">{label}</div>
      <div className="mt-0.5 font-mono text-base text-white" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  )
}

export function Presets({ items }: { items: { label: string; apply: () => void; danger?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((p) => (
        <button key={p.label} type="button" onClick={p.apply}
          className={`rounded-md border px-2 py-1 text-[11px] ${p.danger ? 'border-red-400/40 text-red-300 hover:bg-red-500/10' : 'border-ink-600 text-ink-200 hover:border-teal'}`}>
          {p.label}
        </button>
      ))}
    </div>
  )
}
