import { BookOpen, FlaskConical, GraduationCap, Lock, MessageCircle, Swords } from 'lucide-react'
import type { MissionSummary, Mentor, SimulationInfo } from '@nexora/shared-types'
import { useAsync } from '../../hooks/useAsync'
import { api } from '../../services/api'
import { useApp } from '../../stores/app'
import { Badge, Meter, Panel, STATUS_COLOR, STATUS_LABEL, Spinner } from '../ui/primitives'

export function DistrictPanel({ id }: { id: string }) {
  const { world, concepts, learning, student, open } = useApp()
  const district = world?.districts.find((d) => d.id === id)
  const sims = useAsync(() => api.get<SimulationInfo[]>('/simulations'), [])
  const missions = useAsync(() => api.get<MissionSummary[]>(`/students/${student!.id}/missions`), [student?.id])
  const mentors = useAsync(() => api.get<Mentor[]>('/mentors'), [])
  if (!district) return null
  const prof = mentors.data?.find((m) => m.id === district.professor)
  const list = district.concepts.map((c) => concepts[c]).filter(Boolean)
  return (
    <Panel title={district.building.label} subtitle={`District 0${district.number} · ${district.title}`} accent={district.color} wide>
      <div className="grid gap-5 p-5 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><BookOpen size={16} /> Concepts</h3>
          <ol className="space-y-2">
            {list.map((c, i) => {
              const st = learning?.concepts[c.id]
              const locked = st?.status === 'locked'
              return (
                <li key={c.id}>
                  <button onClick={() => open({ kind: 'lesson', conceptId: c.id })}
                    className="group flex w-full items-start gap-3 rounded-xl border border-ink-700 bg-ink-800/50 p-3 text-left hover:border-ink-400">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold"
                      style={{ background: `${STATUS_COLOR[st?.status ?? 'locked']}22`, color: STATUS_COLOR[st?.status ?? 'locked'] }}>
                      {locked ? <Lock size={13} /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-white">{c.title}</span>
                        {st && <Badge color={STATUS_COLOR[st.status]}>{STATUS_LABEL[st.status]}</Badge>}
                        {st?.review_due && <Badge color="#fb923c">Review due</Badge>}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-400">{c.summary}</span>
                      {locked && st && <span className="mt-1 block text-[11px] text-ink-400">Requires: {st.missing_prerequisites.map((p) => concepts[p]?.title).join(', ')}</span>}
                      {st && st.mastery > 0 && <span className="mt-2 block"><Meter value={st.mastery} color={STATUS_COLOR[st.status]} label={`${c.title} mastery`} /></span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
        <aside className="space-y-5">
          {prof && (
            <div className="rounded-xl border border-ink-700 bg-ink-800/50 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><GraduationCap size={16} /> Professor {prof.name}</h3>
              <p className="mt-1 text-xs text-ink-400">{prof.domain} · {prof.style}</p>
              <button onClick={() => open({ kind: 'mentor', mentorId: prof.id })} className="mt-3 flex items-center gap-1.5 text-sm text-teal hover:underline">
                <MessageCircle size={14} /> Ask a question
              </button>
            </div>
          )}
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><FlaskConical size={16} /> Laboratories</h3>
            {sims.loading ? <Spinner /> : (
              <ul className="space-y-2">
                {sims.data?.filter((s) => district.simulations.includes(s.id)).map((s) => (
                  <li key={s.id}>
                    <button onClick={() => open({ kind: 'lab', simId: s.id })} className="w-full rounded-xl border border-ink-700 bg-ink-800/50 p-3 text-left hover:border-teal">
                      <span className="flex items-center gap-2 font-medium text-white">{s.title} {s.kind !== 'real' && <Badge color="#facc15">{s.kind === 'toy' ? 'toy model' : 'estimates + measurement'}</Badge>}</span>
                      <span className="mt-0.5 block text-xs text-ink-400">{s.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><Swords size={16} /> Mission board</h3>
            {missions.loading ? <Spinner /> : (
              <ul className="space-y-2">
                {missions.data?.filter((m) => district.missions.includes(m.id)).map((m) => (
                  <li key={m.id}>
                    <button onClick={() => open({ kind: 'mission', missionId: m.id })} className="w-full rounded-xl border border-ink-700 bg-ink-800/50 p-3 text-left hover:border-teal">
                      <span className="flex items-center gap-2 font-medium text-white">{m.locked && <Lock size={13} className="text-ink-400" />}{m.title}
                        {m.best?.passed ? <Badge>Passed</Badge> : <Badge color="#94a3b8">{m.difficulty}</Badge>}</span>
                      <span className="mt-0.5 block text-xs text-ink-400">{m.summary}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </Panel>
  )
}

export function GatePanel({ id }: { id: string }) {
  const district = useApp((s) => s.world?.districts.find((d) => d.id === id))
  if (!district) return null
  return (
    <Panel title={district.title} subtitle={`District 0${district.number} · opening in a future release`} accent={district.color}>
      <div className="space-y-4 p-5">
        <p className="text-sm text-ink-200">This district's architecture is part of the NEXORA world, and its curriculum is being built. These subjects will be taught here:</p>
        <div className="flex flex-wrap gap-2">{district.subjects.map((s) => <Badge key={s} color={district.color}>{s}</Badge>)}</div>
        <p className="text-xs text-ink-400">Some of these topics are already introduced in the active districts - for example retrieval (RAG) in the Neural Center and inference memory in the AI Infrastructure laboratory.</p>
      </div>
    </Panel>
  )
}
