/**
 * Failure spectacle event bus.
 *
 * Simulation engine -> scientific result -> backend event classifier -> SimEvent -> this bus -> visuals.
 * Subscribers only *display* events; nothing here can change a scientific result.
 */
import type { Severity, SimEvent } from '@nexora/shared-types'

export type MachineState = 'idle' | 'success' | 'warning' | 'critical'
type Listener = (events: SimEvent[], state: MachineState) => void

const listeners = new Set<Listener>()
let current: MachineState = 'idle'
let lastEvents: SimEvent[] = []

const RANK: Record<Severity, number> = { info: 0, success: 1, warning: 2, critical: 3 }

/** The machine shows the most severe event of the latest run. */
export function stateFor(events: SimEvent[]): MachineState {
  if (!events.length) return 'idle'
  const top = events.reduce((a, b) => (RANK[b.severity] > RANK[a.severity] ? b : a))
  return top.severity === 'info' ? 'idle' : top.severity
}

export function emitSimEvents(events: SimEvent[]): void {
  lastEvents = events
  current = stateFor(events)
  listeners.forEach((l) => l(events, current))
}

export function subscribeSimEvents(l: Listener): () => void {
  listeners.add(l)
  l(lastEvents, current)
  return () => { listeners.delete(l) }
}

export function resetSimEvents(): void { emitSimEvents([]) }
export function machineState(): MachineState { return current }
export function listenerCount(): number { return listeners.size }

/** Reduced motion: the student's setting wins; otherwise follow the OS preference. */
export function prefersReducedMotion(setting?: boolean): boolean {
  if (typeof setting === 'boolean') return setting
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Short-lived camera shake amplitude, consumed by the camera rig each frame. */
export const shake = { amount: 0 }
export function triggerShake(strength = 0.35) { shake.amount = Math.max(shake.amount, strength) }
