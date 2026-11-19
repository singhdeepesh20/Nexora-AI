import { Bug, CheckCircle2, Play, Share2, Timer } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import type { DailyView } from '@nexora/shared-types'
import { api } from '../../services/api'
import { useApp } from '../../stores/app'
import { Markdown } from '../ui/Markdown'
import { Badge, Button, ErrorNote, Panel, Spinner } from '../ui/primitives'

const CodeEditor = lazy(() => import('../missions/CodeEditor'))

/** Local calendar date (YYYY-MM-DD) in the student's own time zone. */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function DailyDebug() {
  const { student, applyResult, open } = useApp()
  const sid = student!.id
  const [day] = useState(localDate())
  const [view, setView] = useState<DailyView | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [now, setNow] = useState(Date.now())
  const draftKey = `nexora.daily.${sid}.${day}`

  useEffect(() => {
    void (async () => {
      try {
        await api.post(`/students/${sid}/daily/start`, { date: day }) // the timer starts when you first open the puzzle
        const v = await api.get<DailyView>(`/students/${sid}/daily?date=${day}`)
        setView(v)
        let draft: string | null = null
        try { draft = localStorage.getItem(draftKey) } catch { /* ignore */ }
        setCode(draft ?? v.starter_code)
      } catch (e) { setError(e) }
    })()
  }, [sid, day, draftKey])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const v = await api.post<DailyView>(`/students/${sid}/daily/submit`, { date: day, code })
      setView(v)
      await applyResult({ xp: v.xp })
    } catch (e) { setError(e) } finally { setBusy(false) }
  }
  const elapsed = view?.solved ? view.seconds ?? 0 : view?.started_at ? Math.max(0, Math.floor((now - Date.parse(view.started_at + 'Z')) / 1000)) : 0
  return (
    <Panel title={view ? `Debug of the Day #${String(view.number).padStart(3, '0')} · ${view.title}` : 'Debug of the Day'}
      subtitle={view ? `${view.topic} · ${view.hidden_tests} hidden tests · about 5 minutes` : undefined} accent="#facc15" wide
      actions={view && <span className="flex items-center gap-1 font-mono text-xs text-ink-200"><Timer size={13} /> {mmss(elapsed)}</span>}>
      {!view ? <div className="p-5">{error ? <ErrorNote error={error} /> : <Spinner />}</div> : (
        <div className="grid h-[min(78vh,820px)] min-h-0 lg:grid-cols-[minmax(300px,0.8fr)_1.2fr]">
          <div className="scroll-thin min-h-0 space-y-4 overflow-y-auto border-r border-white/5 p-5">
            <Markdown source={view.description} />
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">Attempts</h4>
              {view.attempts.length === 0 ? <p className="text-xs text-ink-400">No attempts yet. Hidden tests run only when you submit.</p> : (
                <div className="space-y-1" role="img" aria-label={`${view.attempts.length} attempts`}>
                  {view.attempts.map((row, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs">
                      <span className="w-16 text-ink-400">#{i + 1}</span>
                      {row.map((ok, j) => <span key={j} title={ok ? 'test passed' : 'test failed'}>{ok ? '🟩' : '🟥'}</span>)}
                      <span className="ml-2 text-ink-400">{row.filter(Boolean).length}/{row.length} passed</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {view.last && !view.last.passed && (
              <div className="space-y-1 text-xs">
                {view.last.problem && <pre className="whitespace-pre-wrap rounded-lg bg-ink-950 p-2 text-red-200">{view.last.problem}</pre>}
                {view.last.failures.map((f, i) => <p key={i} className="text-red-200">✗ {f.message || 'A hidden test failed'}</p>)}
              </div>
            )}
            {view.solved && (
              <div className="space-y-3 rounded-xl border border-teal/40 bg-teal/5 p-4">
                <p className="flex items-center gap-2 font-semibold text-teal"><CheckCircle2 size={18} /> Solved in {view.attempts.length} attempt(s), {mmss(view.seconds ?? 0)}</p>
                <p className="text-sm text-ink-200">{view.explanation}</p>
                <pre className="w-fit rounded-lg border border-ink-700 bg-ink-950 p-3 font-mono text-xs text-ink-200">{view.share_text}</pre>
                <Button tone="ghost" onClick={() => open({ kind: 'share', card: 'daily', ref: String(view.number), text: view.share_text ?? undefined })}><Share2 size={14} /> Share result</Button>
              </div>
            )}
            <p className="text-[11px] text-ink-400"><Bug size={11} className="mr-1 inline" />Same date, same puzzle. Uses your computer&apos;s clock - a personal practice calendar, not a global competition. No participation statistics are invented.</p>
          </div>
          <div className="flex min-h-[320px] flex-col">
            <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
              <span className="font-mono text-xs text-ink-400">solution.py</span>
              {view.solved ? <Badge>Solved</Badge> : <Button onClick={() => void submit()} disabled={busy || !code}><Play size={14} /> {busy ? 'Running hidden tests…' : 'Submit fix'}</Button>}
            </div>
            <ErrorNote error={error} />
            <div className="min-h-0 flex-1">
              {code !== null && (
                <Suspense fallback={<div className="p-4"><Spinner label="Loading editor" /></div>}>
                  <CodeEditor value={code} readOnly={view.solved} onChange={(v) => { setCode(v); try { localStorage.setItem(draftKey, v) } catch { /* ignore */ } }} />
                </Suspense>
              )}
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
