import { CheckCircle2, Circle, Lightbulb, Lock, Play, Share2, Swords, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ChallengeResult, ChallengeSummary } from '@nexora/shared-types'
import { useAsync } from '../../hooks/useAsync'
import { api } from '../../services/api'
import { useApp } from '../../stores/app'
import { Num, Select, Toggle } from '../simulations/controls'
import { Badge, Button, ErrorNote, Panel, Spinner, inputCls } from '../ui/primitives'
import { EventBanner } from './EventBanner'

export const LAB_NAMES: Record<string, string> = {
  gradient_descent: 'Gradient Descent Lab', neural_network: 'Neural Network Lab', ml_lab: 'Machine Learning Lab',
  rag: 'RAG Retrieval Lab', infrastructure: 'AI Infrastructure Lab', transformer: 'Transformer Lab',
}
const DIFF_COLOR = { easy: '#2dd4bf', medium: '#facc15', hard: '#f472b6' } as const

export function ChallengeBoard({ lab }: { lab?: string }) {
  const { student, open } = useApp()
  const { data, loading, error } = useAsync(() => api.get<ChallengeSummary[]>(`/students/${student!.id}/challenges`), [student?.id])
  const list = (data ?? []).filter((c) => !c.onboarding && (!lab || c.lab === lab))
  const labs = [...new Set(list.map((c) => c.lab))]
  const solved = list.filter((c) => c.passed).length
  return (
    <Panel title="Break Challenges" subtitle={`Make systems fail on purpose, then explain why · ${solved}/${list.length} solved`} accent="#f472b6" wide>
      <div className="space-y-5 p-5">
        <ErrorNote error={error} />
        {loading && <Spinner />}
        {labs.map((l) => (
          <section key={l}>
            <h3 className="mb-2 text-sm font-semibold text-white">{LAB_NAMES[l] ?? l}</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {list.filter((c) => c.lab === l).map((c) => (
                <button key={c.id} onClick={() => open({ kind: 'challenge', id: c.id })}
                  className="rounded-xl border border-ink-700 bg-ink-800/50 p-3 text-left hover:border-[#f472b6]">
                  <span className="flex items-center gap-2">
                    {c.passed ? <CheckCircle2 size={15} className="text-teal" aria-label="Solved" /> : <Circle size={15} className="text-ink-400" aria-label="Unsolved" />}
                    <span className="font-medium text-white">{c.title}</span>
                    <Badge color={DIFF_COLOR[c.difficulty]}>{c.difficulty}</Badge>
                    <span className="ml-auto text-[11px] text-ink-400">{c.xp} XP</span>
                  </span>
                  <span className="mt-1 block text-xs text-ink-400">{c.description}</span>
                  {c.attempts > 0 && <span className="mt-1 block text-[11px] text-ink-400">{c.attempts} attempt(s){c.passed ? ' · solved' : ''}</span>}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Panel>
  )
}

interface SchemaProp { type?: string; enum?: string[]; anyOf?: SchemaProp[]; minimum?: number; maximum?: number; items?: unknown; description?: string }
interface SimInfo { id: string; config_schema: { properties: Record<string, SchemaProp>; $defs?: Record<string, SchemaProp> } }

export function ChallengePanel({ id }: { id: string }) {
  const { student, open, applyResult } = useApp()
  const sid = student!.id
  const board = useAsync(() => api.get<ChallengeSummary[]>(`/students/${sid}/challenges`), [sid])
  const sims = useAsync(() => api.get<SimInfo[]>('/simulations'), [])
  const c = board.data?.find((x) => x.id === id)
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [res, setRes] = useState<ChallengeResult | null>(null)
  const [hints, setHints] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  useEffect(() => {
    if (c) setConfig(Object.fromEntries(c.allowed.map((k) => [k, c.initial_config[k]])))
  }, [c?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return <Panel title="Challenge"><div className="p-5"><Spinner /></div></Panel>
  const schema = sims.data?.find((s) => s.id === c.lab)?.config_schema
  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await api.post<ChallengeResult>(`/students/${sid}/challenges/${id}/attempt`, { config })
      setRes(r)
      await applyResult(r)
      board.reload()
    } catch (e) { setError(e) } finally { setBusy(false) }
  }
  const nextHint = async () => {
    const h = await api.get<{ hint: string }>(`/challenges/${id}/hints/${hints.length}`)
    setHints((xs) => [...xs, h.hint])
  }
  const fixed = Object.entries(c.initial_config).filter(([k]) => !c.allowed.includes(k))
  return (
    <Panel title={c.title} subtitle={`${LAB_NAMES[c.lab]} · ${c.difficulty} · ${c.xp} XP`} accent={DIFF_COLOR[c.difficulty]} wide
      actions={c.passed && <Badge>Solved</Badge>}>
      <div className="grid gap-5 p-5 lg:grid-cols-[300px_1fr]">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run() }}>
          <p className="text-sm text-ink-200">{c.description}</p>
          <div className="rounded-lg border border-ink-700 p-3">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">Target</h4>
            <ul className="space-y-1 text-xs text-ink-200">{c.target.map((t) => <li key={t}>• {t}</li>)}</ul>
          </div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-400">Your controls</h4>
          {c.allowed.map((k) => <Control key={k} name={k} prop={resolve(schema, k)} value={config[k]} onChange={(v) => setConfig({ ...config, [k]: v })} />)}
          <details className="text-[11px] text-ink-400">
            <summary className="flex cursor-pointer items-center gap-1"><Lock size={11} /> Fixed settings ({fixed.length})</summary>
            <ul className="mt-1 font-mono">{fixed.map(([k, v]) => <li key={k}>{k} = {JSON.stringify(v)}</li>)}</ul>
          </details>
          <Button type="submit" className="w-full" disabled={busy}><Play size={15} /> {busy ? 'Running experiment…' : 'Run experiment'}</Button>
          <ErrorNote error={error} />
          <div>
            {hints.map((h, i) => <p key={i} className="mb-1 flex gap-1.5 text-xs text-yellow-100"><Lightbulb size={13} className="mt-0.5 shrink-0" /> {h}</p>)}
            {hints.length < c.hint_count && <Button type="button" tone="subtle" className="w-full" onClick={() => void nextHint()}><Lightbulb size={14} /> Hint ({hints.length}/{c.hint_count})</Button>}
          </div>
        </form>
        <section className="min-w-0 space-y-4">
          {!res && <div className="grid h-56 place-items-center rounded-xl border border-dashed border-ink-600 text-sm text-ink-400"><span className="flex items-center gap-2"><Swords size={16} /> Run the experiment. The result is evaluated against the real simulation output.</span></div>}
          {res && <>
            <div className={`rounded-xl p-4 ${res.passed ? 'bg-teal/10' : 'bg-red-500/10'}`}>
              <p className={`flex items-center gap-2 font-semibold ${res.passed ? 'text-teal' : 'text-red-300'}`}>
                {res.passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {res.passed ? 'Challenge solved' : 'Not yet'}
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {res.checks.map((ch) => (
                  <li key={ch.label} className={ch.passed ? 'text-teal' : 'text-ink-200'}>{ch.passed ? '✓' : '✗'} {ch.label}
                    <span className="ml-1 text-ink-400">(actual: {fmt(ch.actual)})</span></li>
                ))}
              </ul>
            </div>
            <EventBanner events={res.events} />
            <div className="flex flex-wrap gap-2">
              {Object.entries(res.metrics).map(([k, v]) => <span key={k} className="rounded-md border border-ink-700 px-2 py-1 font-mono text-[11px] text-ink-200">{k}: {fmt(v)}</span>)}
            </div>
            {res.explanation && (
              <div className="rounded-xl border border-sky/30 bg-sky/5 p-3 text-sm text-ink-200">
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-sky">Why it happened</h4>{res.explanation}
              </div>
            )}
            {res.passed && <Button tone="ghost" onClick={() => open({ kind: 'share', card: 'challenge', ref: id })}><Share2 size={14} /> Create share card</Button>}
            <Button tone="subtle" onClick={() => open({ kind: 'lab', simId: c.lab })}>Open the full {LAB_NAMES[c.lab]}</Button>
          </>}
        </section>
      </div>
    </Panel>
  )
}

function fmt(v: unknown): string {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toPrecision(4)
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'none'
  return v === null || v === undefined ? '—' : String(v)
}

function resolve(schema: SimInfo['config_schema'] | undefined, key: string): SchemaProp {
  let p: SchemaProp = schema?.properties[key] ?? {}
  if (p.anyOf) p = { ...p.anyOf.find((x) => x.type !== 'null'), anyOf: p.anyOf }
  return p
}

function Control({ name, prop, value, onChange }: { name: string; prop: SchemaProp; value: unknown; onChange: (v: unknown) => void }) {
  const label = name.replaceAll('_', ' ')
  const nullable = !!prop.anyOf?.some((x) => x.type === 'null')
  if (prop.enum) return <Select label={label} value={String(value)} options={prop.enum} onChange={onChange} />
  if (prop.type === 'boolean') return <Toggle label={label} checked={!!value} onChange={onChange} />
  if (prop.type === 'array') {
    return (
      <label className="block"><span className="mb-1 block text-[11px] font-medium text-ink-400">{label} (comma-separated; empty = none)</span>
        <input className={`${inputCls} py-1.5`} value={Array.isArray(value) ? value.join(', ') : ''}
          onChange={(e) => onChange(e.target.value.split(',').map((x) => x.trim()).filter(Boolean).map(Number))} /></label>
    )
  }
  return <Num label={nullable ? `${label} (blank = none)` : label} value={value as number | null} step={prop.type === 'integer' ? 1 : 'any'}
    min={prop.minimum} max={prop.maximum}
    onChange={(v) => onChange(Number.isNaN(v) ? (nullable ? null : v) : v)} />
}
