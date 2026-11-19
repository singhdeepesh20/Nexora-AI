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

