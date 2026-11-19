import { MessageCircle, Play, Swords } from 'lucide-react'
import type { ChallengeSummary, LearningState, Progression } from '@nexora/shared-types'
import { useAsync } from '../../hooks/useAsync'
import { api } from '../../services/api'
import { useApp } from '../../stores/app'
import { NPCS } from '../world/Characters'
import { Button, Panel, Spinner } from '../ui/primitives'

const DISTRICT: Record<string, string> = { atlas: 'foundation', newton: 'machine_learning', neural: 'deep_learning' }
const LABS: Record<string, string[]> = {
  atlas: ['infrastructure'], newton: ['gradient_descent', 'ml_lab'], neural: ['neural_network', 'rag'], nova: [],
}

/**
 * Deterministic, progress-aware dialogue. Every statement is derived from verified local records
 * (learning state, progression, challenge attempts) - nothing is invented, no AI model is needed.
 */
export function professorLines(id: string, learning: LearningState, prog: Progression | null, challenges: ChallengeSummary[],
  titles: Record<string, string>, onboarding: string | undefined, districtConcepts: string[]): string[] {
  const lines: string[] = []
  const streak = prog?.streak.current ?? 0
  lines.push(streak > 1 ? `Welcome back - that's a ${streak}-day learning streak.` : 'Welcome back. Ready to experiment?')
  if (id === 'nova') {
    if (onboarding === 'pending' || onboarding === undefined) return ["Welcome to NEXORA. Here, you don't just study intelligent systems. You build them, test them, and sometimes break them. Let's begin."]
    if (prog?.rank.next) {
      const gap = prog.rank.next.checks.find((c) => !c.met)
      const amount = (v: number) => (gap?.unit === 'percent' ? `${Math.round(v * 100)}%` : String(v))
      lines.push(`You are a ${prog.rank.title}.` + (gap ? ` To become ${prog.rank.next.title}, work on: ${gap.label.toLowerCase()} (${amount(gap.have)} of ${amount(gap.need)}).` : ''))
    }
    const rec = learning.recommendations[0]
    if (rec) lines.push(`My suggestion for today: ${rec.title}. ${rec.reason}`)
    return lines
  }
  const mine = districtConcepts.map((c) => learning.concepts[c]).filter(Boolean)
  const mastered = mine.filter((s) => s.status === 'mastered').length
  if (mine.length && mastered === mine.length) {
    lines.push(`You have mastered every concept in my district. The building lights are yours.`)
  } else {
    const struggling = mine.find((s) => s.status === 'in_progress' && s.failed_attempts > 0)
    const rec = learning.recommendations.find((r) => districtConcepts.includes(r.concept_id))
    if (struggling) lines.push(`You've attempted ${titles[struggling.concept_id]} ${struggling.failed_attempts} time(s) without passing yet. Mistakes are data - re-read the sections you missed, then try again.`)
    else if (rec) lines.push(`Ready for ${rec.title}? ${rec.reason}`)
    else if (mine.every((s) => s.status === 'locked')) lines.push('My district builds on the Foundation concepts. Master those first, then come and find me.')
    else lines.push(`You've mastered ${mastered} of ${mine.length} concepts here.`)
  }
  const labCh = challenges.filter((c) => LABS[id]?.includes(c.lab) && !c.onboarding)
  const solved = labCh.filter((c) => c.passed)
  const open = labCh.find((c) => !c.passed)
  if (solved.length && open) lines.push(`You solved "${solved[solved.length - 1].title}". Next, try "${open.title}".`)
  else if (open) lines.push(`Want to break something on purpose? Try the "${open.title}" challenge.`)
  else if (labCh.length) lines.push('You have solved every break challenge in my labs. Impressive.')
  return lines
}

export function ProfessorDialog({ id }: { id: string }) {
  const { student, learning, progression, concepts, world, open } = useApp()
  const npc = NPCS.find((n) => n.id === id)!
  const ch = useAsync(() => api.get<ChallengeSummary[]>(`/students/${student!.id}/challenges`), [student?.id])
  const district = world?.districts.find((d) => d.id === DISTRICT[id])
  const titles = Object.fromEntries(Object.values(concepts).map((c) => [c.id, c.title]))
  const lines = learning && ch.data ? professorLines(id, learning, progression, ch.data, titles, student?.settings.onboarding, district?.concepts ?? []) : null
  const needsOnboarding = id === 'nova' && (student?.settings.onboarding ?? 'pending') === 'pending'
  return (
    <Panel title={npc.name} subtitle={npc.role} accent={npc.color}>
      <div className="space-y-4 p-5">
        {!lines ? <Spinner /> : lines.map((l, i) => (
          <p key={i} className="rounded-2xl rounded-tl-sm border px-4 py-3 text-sm text-ink-200" style={{ borderColor: `${npc.color}44`, background: `${npc.color}0d` }}>{l}</p>
        ))}
        <div className="flex flex-wrap gap-2">
          {needsOnboarding && <Button onClick={() => open({ kind: 'onboarding' })}><Play size={15} /> Start the first experiment</Button>}
          {district && <Button tone="ghost" onClick={() => open({ kind: 'district', id: district.id })}>Enter {district.building.label}</Button>}
          {LABS[id]?.length > 0 && <Button tone="ghost" onClick={() => open({ kind: 'challenges' })}><Swords size={15} /> Break challenges</Button>}
          <Button tone="subtle" onClick={() => open({ kind: 'mentor', mentorId: id })}><MessageCircle size={15} /> Ask a question</Button>
        </div>
      </div>
    </Panel>
  )
}
