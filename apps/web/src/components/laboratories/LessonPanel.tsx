import { CheckCircle2, ClipboardCheck, FlaskConical, Lock, MessageCircle, Swords, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Assessment, AssessmentResult, Concept, XPAward } from '@nexora/shared-types'
import { useAsync } from '../../hooks/useAsync'
import { api } from '../../services/api'
import { useApp } from '../../stores/app'
import { Markdown } from '../ui/Markdown'
import { Badge, Button, ErrorNote, Meter, Panel, STATUS_COLOR, STATUS_LABEL, Spinner, inputCls } from '../ui/primitives'

const SIM_TITLES: Record<string, string> = {
  gradient_descent: 'Gradient Descent Lab', neural_network: 'Neural Network Lab', ml_lab: 'Machine Learning Lab',
  transformer: 'Transformer Lab', rag: 'RAG Lab', infrastructure: 'Infrastructure Lab',
}

export function LessonPanel({ conceptId }: { conceptId: string }) {
  const { student, learning, world, concepts, open } = useApp()
  const { data: c, error } = useAsync(() => api.get<Concept>(`/curriculum/concepts/${conceptId}`), [conceptId])
  useEffect(() => { void api.post(`/students/${student!.id}/concepts/${conceptId}/open`) }, [conceptId, student])
  const st = learning?.concepts[conceptId]
  const district = world?.districts.find((d) => d.id === c?.district)
  const locked = st?.status === 'locked'
  return (
    <Panel title={c?.title ?? 'Lesson'} subtitle={district?.title} accent={district?.color} wide
      actions={st && <Badge color={STATUS_COLOR[st.status]}>{STATUS_LABEL[st.status]}</Badge>}>
      {error ? <div className="p-5"><ErrorNote error={error} /></div> : !c ? <div className="p-5"><Spinner /></div> : (
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_300px]">
          <article className="min-w-0">
            {locked && (
              <p className="mb-4 flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-200">
                <Lock size={14} /> Preview only. Master {st!.missing_prerequisites.map((p) => concepts[p]?.title).join(', ')} to unlock the assessment.
              </p>
            )}
            <Markdown source={c.lesson_markdown} />
            {c.examples.length > 0 && (
              <section className="mt-6">
                <h3 className="mb-2 text-sm font-semibold text-white">Worked examples</h3>
                {c.examples.map((e) => (
                  <div key={e.title} className="mb-3">
                    <div className="mb-1 text-xs text-ink-400">{e.title}</div>
                    {e.code && <pre className="scroll-thin overflow-x-auto rounded-lg border border-ink-700 bg-ink-950 p-3 font-mono text-xs text-ink-200">{e.code}</pre>}
                  </div>
                ))}
              </section>
            )}
          </article>
          <aside className="space-y-4">
            <div className="rounded-xl border border-ink-700 bg-ink-800/50 p-4">
              <h3 className="text-sm font-semibold text-white">Learning objectives</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-ink-200">{c.objectives.map((o) => <li key={o}>• {o}</li>)}</ul>
            </div>
            {st && (
              <div className="rounded-xl border border-ink-700 bg-ink-800/50 p-4 text-xs text-ink-200">
                <h3 className="mb-2 text-sm font-semibold text-white">Your competency</h3>
                <Meter value={st.mastery} color={STATUS_COLOR[st.status]} label="Mastery" />
                <p className="mt-2">Mastery {(st.mastery * 100).toFixed(0)}% · best assessment {(st.best_assessment_score * 100).toFixed(0)}% · {st.assessment_attempts} attempt(s)</p>
                {c.required_mission && <p className="mt-1">Requires mission: <b>{c.required_mission.replaceAll('_', ' ')}</b> {st.required_mission_passed ? '✓' : '(not yet passed)'}</p>}
                <p className="mt-2 text-ink-400">Mastery comes only from passing the assessment (≥80%){c.required_mission ? ' and the required mission' : ''}. Reading does not count.</p>
              </div>
            )}
            <div className="space-y-2">
              <Button className="w-full" disabled={locked} onClick={() => open({ kind: 'assessment', conceptId })}><ClipboardCheck size={16} /> Take the assessment</Button>
              {c.simulations.map((s) => <Button key={s} tone="ghost" className="w-full" onClick={() => open({ kind: 'lab', simId: s })}><FlaskConical size={16} /> {SIM_TITLES[s] ?? s}</Button>)}
              {c.missions.map((m) => <Button key={m} tone="ghost" className="w-full" onClick={() => open({ kind: 'mission', missionId: m })}><Swords size={16} /> Mission: {m.replaceAll('_', ' ')}</Button>)}
              {district && <Button tone="subtle" className="w-full" onClick={() => open({ kind: 'mentor', mentorId: district.professor, prompt: c.title })}><MessageCircle size={16} /> Ask the professor</Button>}
            </div>
          </aside>
        </div>
      )}
    </Panel>
  )
}

export function AssessmentPanel({ conceptId }: { conceptId: string }) {
  const { student, concepts, applyResult, toast } = useApp()
  const { data: a, error } = useAsync(() => api.get<Assessment>(`/curriculum/concepts/${conceptId}/assessment`), [conceptId])
  const [answers, setAnswers] = useState<Record<string, string | number>>({})
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [submitErr, setSubmitErr] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    setSubmitErr(null)
    try {
      const r = await api.post<AssessmentResult>(`/students/${student!.id}/concepts/${conceptId}/assessment`, { answers })
      setResult(r)
      if (r.unlocked.length) toast(`Unlocked: ${r.unlocked.map((u) => concepts[u]?.title).join(', ')}`, 'success')
      await applyResult(r as AssessmentResult & { xp: XPAward[] })
    } catch (e) { setSubmitErr(e) } finally { setBusy(false) }
  }
  const byId = Object.fromEntries((result?.results ?? []).map((r) => [r.id, r]))
  return (
    <Panel title={`Assessment · ${concepts[conceptId]?.title ?? ''}`} subtitle={a ? `Pass mark ${(a.pass_score * 100).toFixed(0)}% · deterministic grading` : undefined}>
      <div className="space-y-5 p-5">
        <ErrorNote error={error} />
        {!a ? <Spinner /> : a.questions.map((q, i) => {
          const r = byId[q.id]
          return (
            <fieldset key={q.id} className={`rounded-xl border p-4 ${r ? (r.correct ? 'border-teal/50' : 'border-red-400/50') : 'border-ink-700'}`}>
              <legend className="px-1 text-xs text-ink-400">Question {i + 1}</legend>
              <p className="mb-3 text-sm text-white">{q.prompt}</p>
              {q.type === 'choice' ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options!.map((o, k) => (
                    <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${answers[q.id] === k ? 'border-teal bg-teal/10 text-white' : 'border-ink-700 text-ink-200'}`}>
                      <input type="radio" name={q.id} className="accent-teal-400" checked={answers[q.id] === k} disabled={!!result} onChange={() => setAnswers({ ...answers, [q.id]: k })} />
                      {o}
                    </label>
                  ))}
                </div>
              ) : (
                <input className={`${inputCls} max-w-48`} inputMode="decimal" placeholder="Your answer" disabled={!!result}
                  value={answers[q.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} aria-label={`Answer to question ${i + 1}`} />
              )}
              {r && (
                <p className={`mt-3 flex items-start gap-2 text-xs ${r.correct ? 'text-teal' : 'text-red-300'}`}>
                  {r.correct ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  <span>{r.correct ? 'Correct. ' : `Expected ${String(r.expected)}. `}<span className="text-ink-200">{r.explanation}</span></span>
                </p>
              )}
            </fieldset>
          )
        })}
        <ErrorNote error={submitErr} />
        {result ? (
          <div className={`rounded-xl p-4 ${result.passed ? 'bg-teal/10 text-teal' : 'bg-red-500/10 text-red-300'}`}>
            <p className="font-semibold">Score {(result.score * 100).toFixed(0)}% - {result.passed ? 'passed' : 'not yet passed'}</p>
            <p className="mt-1 text-xs text-ink-200">Concept status: {STATUS_LABEL[result.concept_state.status]}. {result.concept_state.required_mission && !result.concept_state.required_mission_passed ? 'Complete the required mission to master this concept.' : ''}</p>
            <Button tone="ghost" className="mt-3" onClick={() => { setResult(null); setAnswers({}) }}>Try again</Button>
          </div>
        ) : a && (
          <Button onClick={submit} disabled={busy || Object.keys(answers).length === 0}>{busy ? 'Grading…' : 'Submit answers'}</Button>
        )}
      </div>
    </Panel>
  )
}
