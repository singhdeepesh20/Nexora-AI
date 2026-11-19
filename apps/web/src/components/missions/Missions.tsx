import { CheckCircle2, CircleAlert, Lock, Play, RotateCcw, ShieldCheck, Swords, XCircle } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import type { MissionDetail, MissionResult, MissionSummary, XPAward } from '@nexora/shared-types'
import { useAsync } from '../../hooks/useAsync'
import { api } from '../../services/api'
import { useApp } from '../../stores/app'
import { Markdown } from '../ui/Markdown'
import { Badge, Button, ErrorNote, Meter, Panel, Spinner } from '../ui/primitives'

const CodeEditor = lazy(() => import('./CodeEditor'))
const DRAFT = (sid: string, mid: string) => `nexora.draft.${sid}.${mid}`

export function MissionBoard() {
  const { student, concepts, open } = useApp()
  const { data, loading, error } = useAsync(() => api.get<MissionSummary[]>(`/students/${student!.id}/missions`), [student?.id])
  return (
    <Panel title="Mission Board" subtitle="Real engineering problems, evaluated by hidden automated tests" wide>
      <div className="grid gap-3 p-5 md:grid-cols-2">
        <ErrorNote error={error} />
        {loading && <Spinner />}
        {data?.map((m) => (
          <button key={m.id} onClick={() => open({ kind: 'mission', missionId: m.id })}
            className="rounded-xl border border-ink-700 bg-ink-800/50 p-4 text-left hover:border-teal">
            <div className="flex flex-wrap items-center gap-2">
              {m.locked ? <Lock size={15} className="text-ink-400" /> : <Swords size={15} className="text-teal" />}
              <span className="font-semibold text-white">{m.title}</span>
              <Badge color="#94a3b8">{m.difficulty}</Badge>
              {m.best?.passed && <Badge>Passed</Badge>}
            </div>
            <p className="mt-1 text-sm text-ink-400">{m.summary}</p>
            {m.best && <div className="mt-3"><Meter value={m.best.best_score} label="Best score" /><p className="mt-1 text-[11px] text-ink-400">Best {(m.best.best_score * 100).toFixed(0)}% · {m.best.attempts} submission(s)</p></div>}
            {m.locked && <p className="mt-2 text-[11px] text-ink-400">Requires mastery of: {m.missing_prerequisites.map((p) => concepts[p]?.title).join(', ')}</p>}
          </button>
        ))}
      </div>
    </Panel>
  )
}

export function MissionWorkspace({ missionId }: { missionId: string }) {
  const { student, applyResult, toast, concepts } = useApp()
  const detail = useAsync(() => api.get<MissionDetail>(`/missions/${missionId}`), [missionId])
  const board = useAsync(() => api.get<MissionSummary[]>(`/students/${student!.id}/missions`), [student?.id])
  const summary = board.data?.find((m) => m.id === missionId)
  const [code, setCode] = useState<string | null>(null)
  const [result, setResult] = useState<MissionResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [tab, setTab] = useState<'brief' | 'results'>('brief')

  useEffect(() => {
    if (!detail.data || code !== null) return
    let draft: string | null = null
    try { draft = localStorage.getItem(DRAFT(student!.id, missionId)) } catch { /* ignore */ }
    if (draft) { setCode(draft); return }
    // fall back to the latest submission, then the starter
    api.get<{ code: string }[]>(`/students/${student!.id}/missions/${missionId}/submissions`)
      .then((subs) => setCode(subs[0]?.code ?? detail.data!.starter_code))
      .catch(() => setCode(detail.data!.starter_code))
  }, [detail.data, code, student, missionId])

  const edit = (v: string) => {
    setCode(v)
    try { localStorage.setItem(DRAFT(student!.id, missionId), v) } catch { /* ignore */ }
  }
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await api.post<MissionResult>(`/students/${student!.id}/missions/${missionId}/submit`, { code })
      setResult(r)
      setTab('results')
      await applyResult(r as MissionResult & { xp: XPAward[] })
      if (r.newly_mastered.length) toast(`Mastered: ${r.newly_mastered.map((c) => concepts[c]?.title).join(', ')}`, 'success')
      await refreshLearning()
      board.reload()
    } catch (e) { setError(e) } finally { setBusy(false) }
  }
  const d = detail.data
  return (
    <Panel title={d ? `Mission · ${d.title}` : 'Mission'} subtitle={d ? `${d.difficulty} · submission: ${d.submission_format}` : undefined} wide
      actions={<Button onClick={submit} disabled={busy || !code || summary?.locked}><Play size={15} /> {busy ? 'Running tests…' : 'Submit for evaluation'}</Button>}>
      {!d ? <div className="p-5"><Spinner /></div> : (
        <div className="grid h-[min(78vh,820px)] min-h-0 lg:grid-cols-[minmax(320px,0.9fr)_1.1fr]">
          <div className="scroll-thin min-h-0 overflow-y-auto border-r border-white/5 p-5">
            <div className="mb-4 flex gap-1 rounded-lg bg-ink-800 p-1 text-xs">
              {(['brief', 'results'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-md px-3 py-1.5 capitalize ${tab === t ? 'bg-ink-600 text-white' : 'text-ink-400'}`}>{t}</button>
              ))}
            </div>
            {summary?.locked && <p className="mb-3 flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm"><Lock size={14} /> Locked - master {summary.missing_prerequisites.map((p) => concepts[p]?.title).join(', ')} first. You can still read and draft.</p>}
            <ErrorNote error={error} />
            {tab === 'brief' ? (
              <div className="space-y-4">
                <Markdown source={d.description} />
                <div><h4 className="mb-1 text-sm font-semibold text-white">Requirements</h4>
                  <ul className="space-y-1 text-sm text-ink-200">{d.requirements.map((r) => <li key={r}>• {r}</li>)}</ul></div>
                <div><h4 className="mb-1 text-sm font-semibold text-white">Evaluation</h4>
                  <p className="text-xs text-ink-400">{d.evaluation.pass_rule}. Weights: {Object.entries(d.evaluation.weights).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(' · ')}. Hidden tests: {d.test_names.length}. Time limit {d.time_limit_s}s.</p></div>
              </div>
            ) : result ? <ResultView r={result} /> : <p className="text-sm text-ink-400">Submit your code to see test results.</p>}
          </div>
          <div className="flex min-h-[320px] flex-col">
            <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5 text-xs text-ink-400">
              <span className="font-mono">solution.py</span>
              <button className="flex items-center gap-1 hover:text-white" onClick={() => { if (confirm('Replace your code with the starter template?')) edit(d.starter_code) }}><RotateCcw size={12} /> Reset to starter</button>
            </div>
            <div className="min-h-0 flex-1">
              {code === null ? <div className="p-4"><Spinner /></div> : (
                <Suspense fallback={<div className="p-4"><Spinner label="Loading editor" /></div>}>
                  <CodeEditor value={code} onChange={edit} />
                </Suspense>
              )}
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}

function ResultView({ r }: { r: MissionResult }) {
  return (
    <div className="space-y-4">
      <div className={`rounded-xl p-4 ${r.passed ? 'bg-teal/10' : 'bg-red-500/10'}`}>
        <p className={`flex items-center gap-2 font-semibold ${r.passed ? 'text-teal' : 'text-red-300'}`}>
          {r.passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {r.passed ? 'Mission passed' : 'Not passed yet'} · score {(r.score * 100).toFixed(0)}%
        </p>
        <p className="mt-1 text-xs text-ink-400">{r.rule} · ran in {r.duration_ms < 1000 ? `${r.duration_ms.toFixed(0)} ms` : `${(r.duration_ms / 1000).toFixed(1)} s`}</p>
      </div>
      {r.problem && <pre className="scroll-thin overflow-x-auto whitespace-pre-wrap rounded-lg border border-red-400/30 bg-ink-950 p-3 text-xs text-red-200">{r.problem}</pre>}
      <div className="grid grid-cols-2 gap-2">
        {(['correctness', 'reliability', 'performance', 'quality'] as const).map((k) => {
          const c = r.categories[k]
          return <div key={k} className="rounded-lg border border-ink-700 p-2.5"><div className="mb-1 flex justify-between text-xs"><span className="capitalize text-ink-200">{k}</span>
            <span className="font-mono text-ink-400">{c.total !== undefined ? `${c.passed}/${c.total}` : `${(c.score * 100).toFixed(0)}%`}</span></div><Meter value={c.score} label={k} /></div>
        })}
      </div>
      <ul className="space-y-1.5">
        {r.tests.map((t) => (
          <li key={t.name} className="rounded-lg border border-ink-700 p-2 text-xs">
            <div className="flex items-center gap-2">{t.status === 'passed' ? <CheckCircle2 size={14} className="text-teal" /> : <CircleAlert size={14} className="text-red-300" />}
              <span className="font-mono text-ink-200">{t.name}</span><span className="ml-auto text-ink-400">{t.category} · {t.duration_ms.toFixed(0)} ms</span></div>
            {t.message && <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-red-200">{t.message}</pre>}
          </li>
        ))}
      </ul>
      {r.categories.quality.checks && (
        <div><h4 className="mb-1 text-xs font-semibold text-white">Code quality (static analysis)</h4>
          <ul className="space-y-0.5 text-xs">{r.categories.quality.checks.map((c) => <li key={c.id} className={c.ratio >= 1 ? 'text-ink-400' : 'text-yellow-200'}>{c.ratio >= 1 ? '✓' : '•'} {c.label}{c.ratio < 1 && c.detail.length ? ` - ${c.detail.join(', ')}` : ''}</li>)}</ul></div>
      )}
      <p className="flex items-start gap-2 text-[11px] text-ink-400"><ShieldCheck size={13} className="mt-0.5 shrink-0" /> Sandbox: {r.isolation.os_sandbox} ({r.isolation.strength}). {r.isolation.notes}</p>
    </div>
  )
}
