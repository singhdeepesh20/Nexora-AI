import { BadgeCheck, GraduationCap, IdCard as IdIcon, ShieldCheck, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { GateResult, IdCard, TalkResult } from '@nexora/shared-types'
import { useAsync } from '../../hooks/useAsync'
import { api } from '../../services/api'
import { useApp } from '../../stores/app'
import { Badge, Button, ErrorNote, Meter, Panel, Spinner, inputCls } from '../ui/primitives'

const GREEN = '#22c55e'

function Speech({ who, lines, color = GREEN }: { who: string; lines: string[]; color?: string }) {
  return (
    <div className="space-y-2" aria-live="polite">
      {lines.map((l, i) => (
        <p key={i} className="rounded-2xl rounded-tl-sm border px-4 py-2.5 text-sm text-ink-200" style={{ borderColor: `${color}44`, background: `${color}0d` }}>
          {i === 0 && <b className="mr-1 text-white">{who}:</b>}{l}
        </p>
      ))}
    </div>
  )
}

/** The security checkpoint. The guard verifies the presented ID against the locally stored profile. */
export function GuardDialog() {
  const { student, idCard, openGate, gateOpen, open, back } = useApp()
  const [result, setResult] = useState<GateResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const present = async (card: string | null) => {
    setBusy(true)
    setError(null)
    try {
      const r = await api.post<GateResult>(`/students/${student!.id}/gate/verify`, { card_number: card })
      setResult(r)
      if (r.verified) openGate()
    } catch (e) { setError(e) } finally { setBusy(false) }
  }
  const lines = result?.lines ?? ['Good morning! Welcome to NEXORA University.', 'May I see your student ID card?']
  return (
    <Panel title="Officer Rahman" subtitle="Campus Security · Main Gate" accent="#1e3a5f">
      <div className="space-y-4 p-5">
        <Speech who="Officer Rahman" lines={lines} color="#38bdf8" />
        <ErrorNote error={error} />
        {gateOpen && result?.verified ? (
          <p className="flex items-center gap-2 text-sm text-green-300"><ShieldCheck size={16} /> The barrier is up. Walk through the gate.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {idCard
              ? <Button onClick={() => void present(idCard.card_number)} disabled={busy}><IdIcon size={15} /> Present student ID ({idCard.card_number})</Button>
              : <Button onClick={() => void present(null)} disabled={busy}>I don&apos;t have an ID yet</Button>}
            {result?.reason === 'no_card' && <Button tone="ghost" onClick={() => open({ kind: 'admission' })}>Go to the Admission Office</Button>}
          </div>
        )}
        {result?.verified && <Button tone="subtle" onClick={back}>Thank you</Button>}
      </div>
    </Panel>
  )
}

/** Admission: choose a department and learning track; issues the simulated student ID. */
export function Admission() {
  const { student, campus, idCard, setIdCard, open } = useApp()
  const deps = campus?.departments ?? []
  const [dep, setDep] = useState(deps[3]?.id ?? deps[0]?.id ?? '')
  const tracks = deps.find((d) => d.id === dep)?.tracks ?? []
  const [track, setTrack] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  useEffect(() => { setTrack(tracks[0] ?? '') }, [dep]) // eslint-disable-line react-hooks/exhaustive-deps
  const issue = async () => {
    setBusy(true)
    setError(null)
    try {
      const c = await api.post<IdCard>(`/students/${student!.id}/id-card`, { department: dep, track })
      setIdCard(c)
      open({ kind: 'idcard' })
    } catch (e) { setError(e) } finally { setBusy(false) }
  }
  return (
    <Panel title="Admission & Visitor Centre" subtitle={campus?.university.name} accent={GREEN}>
      <div className="space-y-4 p-5">
        <Speech who="Ms. Okonkwo, Admissions" lines={idCard
          ? [`You're already enrolled, ${student?.display_name}. Your card number is ${idCard.card_number}.`]
          : [`Welcome, ${student?.display_name}! Let's get you enrolled.`, 'Choose the department you want to start in. You can still study every subject on campus.']} />
        {!idCard && (
          <>
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-ink-400">Department</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {deps.map((d) => (
                  <label key={d.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${dep === d.id ? 'border-green-500 bg-green-500/10 text-white' : 'border-ink-700 text-ink-200'}`}>
                    <input type="radio" name="dep" className="accent-green-500" checked={dep === d.id} onChange={() => setDep(d.id)} /> {d.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block"><span className="mb-1 block text-xs font-medium text-ink-400">Learning track</span>
              <select className={inputCls} value={track} onChange={(e) => setTrack(e.target.value)}>{tracks.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <ErrorNote error={error} />
            <Button onClick={() => void issue()} disabled={busy || !track}><GraduationCap size={15} /> {busy ? 'Issuing…' : 'Enrol and issue my student ID'}</Button>
          </>
        )}
        {idCard && <Button onClick={() => open({ kind: 'idcard' })}><IdIcon size={15} /> View my ID card</Button>}
        <p className="text-[11px] text-ink-400">{campus?.university.disclaimer}</p>
      </div>
    </Panel>
  )
}

/** Decorative pattern derived from the card number. Not scannable, not a credential. */
function Pattern({ seed }: { seed: string }) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  const cells = Array.from({ length: 49 }, (_, i) => ((h >>> (i % 31)) ^ (i * 2654435761)) & 1)
  return (
    <svg viewBox="0 0 7 7" className="h-16 w-16 rounded bg-white p-1" role="img" aria-label="Decorative pattern (not a security code)">
      {cells.map((on, i) => on ? <rect key={i} x={i % 7} y={Math.floor(i / 7)} width={1} height={1} fill="#111827" /> : null)}
    </svg>
  )
}

function Portrait({ body, accent }: { body: string; accent: string }) {
  return (
    <svg viewBox="0 0 80 96" className="h-24 w-20 rounded-md bg-gradient-to-b from-slate-200 to-slate-300" role="img" aria-label="Avatar portrait">
      <rect x="12" y="62" width="56" height="34" rx="14" fill={body} />
      <rect x="34" y="56" width="12" height="10" fill="#c98f6b" />
      <circle cx="40" cy="40" r="16" fill="#d9a07a" />
      <path d="M24 38 Q26 20 40 21 Q55 21 56 38 Q52 28 40 28 Q29 28 24 38Z" fill="#2e1f16" />
      <circle cx="34" cy="41" r="1.6" fill="#1f2937" /><circle cx="46" cy="41" r="1.6" fill="#1f2937" />
      <path d="M36 49 Q40 52 44 49" stroke="#7c4a33" strokeWidth="1.5" fill="none" />
      <rect x="37" y="66" width="6" height="30" fill={accent} />
    </svg>
  )
}

export function IdCardView() {
  const { idCard, student, campus, open } = useApp()
  if (!idCard) {
    return (
      <Panel title="Student ID" accent={GREEN}>
        <div className="space-y-3 p-5 text-sm text-ink-200"><p>You don&apos;t have a student ID yet. Visit the Admission & Visitor Centre beside the main gate.</p>
          <Button onClick={() => open({ kind: 'admission' })}>Open admission</Button></div>
      </Panel>
    )
  }
  return (
    <Panel title="Student ID card" subtitle="Press I any time to show it" accent={GREEN}>
      <div className="space-y-3 p-5">
        <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-white/10 shadow-2xl" style={{ background: 'linear-gradient(135deg,#f5f5f4,#e7e5e4)' }}>
          <div className="flex items-center justify-between bg-[#14532d] px-5 py-3 text-white">
            <div>
              <div className="font-serif text-lg font-bold tracking-wide">{idCard.university}</div>
              <div className="text-[10px] tracking-[0.25em] text-green-100">{campus?.university.motto}</div>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-full border-2 border-white/80 font-serif text-lg font-bold">N</div>
          </div>
          <div className="flex gap-4 p-5 text-slate-800">
            <Portrait body={student?.avatar?.body_color ?? '#22c55e'} accent={student?.avatar?.accent_color ?? '#38bdf8'} />
            <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
              <dt className="text-slate-500">Name</dt><dd className="font-semibold">{idCard.name}</dd>
              <dt className="text-slate-500">Student ID</dt><dd className="font-mono">{idCard.card_number}</dd>
              <dt className="text-slate-500">Department</dt><dd>{idCard.department}</dd>
              <dt className="text-slate-500">Track</dt><dd>{idCard.track}</dd>
              <dt className="text-slate-500">Enrolled</dt><dd>{idCard.enrollment_year} · Year {idCard.academic_year}</dd>
              <dt className="text-slate-500">Rank</dt><dd className="font-semibold text-[#14532d]">{idCard.rank}</dd>
            </dl>
            <Pattern seed={idCard.card_number} />
          </div>
        </div>
        <p className="text-center text-[11px] text-ink-400">{idCard.notice}</p>
      </div>
    </Panel>
  )
}

interface PortalData {
  disclaimer: string; id_card: IdCard | null; rank: { title: string }; xp: number; level: number
  current_courses: { id: string; title: string; status: string; mastery: number }[]
  assignments: { id: string; title: string; difficulty: string; status: string }[]
  results: { concept: string; score: number; passed: boolean; date: string }[]
  skills: { skill_id: string; name: string; level: number }[]
  participation: { active_days_last_30: number; streak: number; label: string }
  achievements: number; projects: number; classmates: { known: number; friends: number }; not_yet_available: string[]
}

export function Portal() {
  const { student, open } = useApp()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const { data: p, error } = useAsync(() => api.get<PortalData>(`/students/${student!.id}/portal?tz=${encodeURIComponent(tz)}`), [student?.id])
  return (
    <Panel title="Student Portal" subtitle="NEXORA University · student information system" accent={GREEN} wide>
      {!p ? <div className="p-5">{error ? <ErrorNote error={error} /> : <Spinner />}</div> : (
        <div className="grid gap-5 p-5 lg:grid-cols-3">
          <section className="space-y-3 rounded-xl border border-ink-700 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><IdIcon size={16} /> Profile</h3>
            {p.id_card ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-ink-200">
                <dt className="text-ink-400">Student ID</dt><dd className="font-mono">{p.id_card.card_number}</dd>
                <dt className="text-ink-400">Department</dt><dd>{p.id_card.department}</dd>
                <dt className="text-ink-400">Track</dt><dd>{p.id_card.track}</dd>
                <dt className="text-ink-400">Year · Semester</dt><dd>Year {p.id_card.academic_year} · Semester {p.id_card.semester}</dd>
                <dt className="text-ink-400">Rank</dt><dd>{p.rank.title} · Lv {p.level} · {p.xp} XP</dd>
              </dl>
            ) : <Button onClick={() => open({ kind: 'admission' })}>Enrol at the Admission Office</Button>}
            <div className="text-xs text-ink-200">
              <div className="mb-1 text-ink-400">Learning participation</div>
              {p.participation.active_days_last_30} active days in the last 30 · {p.participation.streak}-day streak
              <p className="mt-1 text-[10px] text-ink-400">{p.participation.label}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <Badge>{p.achievements} achievements</Badge><Badge color="#38bdf8">{p.projects} projects</Badge>
              <Badge color="#a78bfa"><Users size={11} className="mr-1" />{p.classmates.known} classmates · {p.classmates.friends} friends</Badge>
            </div>
          </section>
          <section className="space-y-3 rounded-xl border border-ink-700 p-4">
            <h3 className="text-sm font-semibold text-white">Current courses</h3>
            <ul className="space-y-2 text-xs">{p.current_courses.map((c) => (
              <li key={c.id}><button className="w-full text-left" onClick={() => open({ kind: 'lesson', conceptId: c.id })}>
                <div className="flex justify-between text-ink-200"><span>{c.title}</span><span className="text-ink-400">{c.status.replace('_', ' ')}</span></div>
                <Meter value={c.mastery} label={c.title} /></button></li>))}</ul>
            <h3 className="pt-2 text-sm font-semibold text-white">Assignments</h3>
            <ul className="space-y-1 text-xs">{p.assignments.map((a) => (
              <li key={a.id} className="flex items-center gap-2"><button className="text-left text-ink-200 hover:text-white" onClick={() => open({ kind: 'mission', missionId: a.id })}>{a.title}</button>
                <span className={`ml-auto ${a.status === 'passed' ? 'text-green-300' : 'text-ink-400'}`}>{a.status === 'passed' && <BadgeCheck size={12} className="mr-1 inline" />}{a.status}</span></li>))}</ul>
          </section>
          <section className="space-y-3 rounded-xl border border-ink-700 p-4">
            <h3 className="text-sm font-semibold text-white">Recent results</h3>
            <ul className="space-y-1 text-xs">{p.results.length ? p.results.map((r, i) => (
              <li key={i} className="flex gap-2 text-ink-200"><span>{r.concept}</span><span className={`ml-auto font-mono ${r.passed ? 'text-green-300' : 'text-red-300'}`}>{Math.round(r.score * 100)}%</span></li>
            )) : <li className="text-ink-400">No assessments yet.</li>}</ul>
            <h3 className="pt-2 text-sm font-semibold text-white">Skills</h3>
            <ul className="space-y-1.5 text-xs">{p.skills.map((s) => <li key={s.skill_id}><div className="mb-0.5 flex justify-between text-ink-200"><span>{s.name}</span><span className="font-mono text-ink-400">{Math.round(s.level * 100)}%</span></div><Meter value={s.level} label={s.name} /></li>)}</ul>
          </section>
          <p className="text-[11px] text-ink-400 lg:col-span-3">Not yet available: {p.not_yet_available.join(', ')}. {p.disclaimer}</p>
        </div>
      )}
    </Panel>
  )
}

/** Conversation with a classmate. Lines come from the backend: authored dialogue + verified facts only. */
export function ClassmateDialog({ id }: { id: string }) {
  const { student, campus } = useApp()
  const who = campus?.students.find((s) => s.id === id)
  const [talk, setTalk] = useState<TalkResult | null>(null)
  const [error, setError] = useState<unknown>(null)
  const say = () => api.post<TalkResult>(`/students/${student!.id}/classmates/${id}/talk`).then(setTalk, setError)
  useEffect(() => { void say() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  const STATUS = { stranger: 'New face', acquaintance: 'Acquaintance', friend: 'Friend' } as const
  return (
    <Panel title={who?.name ?? 'Classmate'} subtitle={who ? `${who.department_name} · ${who.archetype.replaceAll('_', ' ')}` : undefined} accent="#a78bfa"
      actions={talk && <Badge color={talk.relation.status === 'friend' ? GREEN : '#94a3b8'}>{STATUS[talk.relation.status]}</Badge>}>
      <div className="space-y-4 p-5">
        <ErrorNote error={error} />
        {!talk ? <Spinner /> : <Speech who={who?.name.split(' ')[0] ?? ''} lines={talk.lines} color="#a78bfa" />}
        {talk && talk.relation.status !== 'friend' && (
          <p className="text-[11px] text-ink-400">Talk {talk.relation.friend_after - talk.relation.conversations} more time(s) to become friends. Conversations are stored only on this computer.</p>
        )}
        <Button tone="ghost" onClick={() => void say()}>Keep talking</Button>
      </div>
    </Panel>
  )
}
