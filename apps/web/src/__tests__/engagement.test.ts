import { describe, expect, it, vi } from 'vitest'
import type { ChallengeSummary, LearningState, ShareCard, SimEvent } from '@nexora/shared-types'
import { emitSimEvents, listenerCount, machineState, prefersReducedMotion, resetSimEvents, stateFor, subscribeSimEvents } from '../engine/simEvents'
import { layoutCard } from '../components/engagement/shareCard'
import { professorLines } from '../components/engagement/ProfessorDialog'
import { localDate } from '../components/engagement/Daily'

const ev = (type: SimEvent['type'], severity: SimEvent['severity']): SimEvent => ({ type, severity, title: type, message: '', metrics: {} })

describe('failure spectacle event bus', () => {
  it('derives machine state from the most severe real event', () => {
    expect(stateFor([])).toBe('idle')
    expect(stateFor([ev('OSCILLATION', 'warning'), ev('LOSS_DIVERGENCE', 'critical')])).toBe('critical')
    expect(stateFor([ev('SUCCESSFUL_CONVERGENCE', 'success')])).toBe('success')
  })

  it('notifies subscribers and releases them (no listener leaks)', () => {
    const before = listenerCount()
    const fn = vi.fn()
    const off = subscribeSimEvents(fn)
    emitSimEvents([ev('LOSS_DIVERGENCE', 'critical')])
    expect(machineState()).toBe('critical')
    expect(fn).toHaveBeenLastCalledWith([expect.objectContaining({ type: 'LOSS_DIVERGENCE' })], 'critical')
    emitSimEvents([ev('SUCCESSFUL_CONVERGENCE', 'success')])
    expect(machineState()).toBe('success') // convergence clears the failure state
    off()
    for (let i = 0; i < 50; i++) subscribeSimEvents(() => undefined)()
    expect(listenerCount()).toBe(before)
    resetSimEvents()
    expect(machineState()).toBe('idle')
  })

  it('student reduced-motion setting overrides the OS preference', () => {
    expect(prefersReducedMotion(true)).toBe(true)
    expect(prefersReducedMotion(false)).toBe(false)
  })
})

describe('share card layout', () => {
  const card: ShareCard = {
    layout: 'mission', eyebrow: 'ENGINEERING MISSION COMPLETE', title: 'TRAIN A NEURAL NETWORK', headline: 'Solved XOR',
    stats: [{ label: 'Attempts', value: '3' }, { label: 'Hidden tests passed', value: '6/6' }, { label: 'Score', value: '100%' },
      { label: 'Gradient verification', value: 'Passed' }, { label: 'extra', value: 'dropped' }],
    rank: 'Engineer', footer: 'LEARN AI BY ENGINEERING AI.', name: null, verified_at: '2026-01-01T00:00:00',
  }
  it('places only the verified fields it was given', () => {
    const L = layoutCard(card)
    expect(L.lines.map((l) => l.text)).toContain('ENGINEERING MISSION COMPLETE')
    expect(L.stats).toHaveLength(4)
    expect(L.name).toBeNull()
    expect(JSON.stringify(L)).not.toContain('dropped')
  })
})

