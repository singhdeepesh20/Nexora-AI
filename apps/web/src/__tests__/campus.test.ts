import { describe, expect, it } from 'vitest'
import { buildLayout, stepPlayer } from '@nexora/world-engine'
import { BARRIER_COLLIDER, ENTRANCE_COLLIDERS, GATE_Z } from '../components/world/Entrance'
import { lookFor } from '../components/world/Human'
import { phaseFor } from '../engine/timeOfDay'

const bounds = { min_x: -68, max_x: 68, min_z: -76, max_z: 100 }
const walkNorth = (gateOpen: boolean) => {
  const layout = buildLayout(bounds, [], [...ENTRANCE_COLLIDERS, ...(gateOpen ? [] : [BARRIER_COLLIDER])])
  let s = { x: 0, z: 70, heading: 0 }
  for (let i = 0; i < 400; i++) s = stepPlayer(s, { forward: true, back: false, left: false, right: false, run: false }, 0, 0.05, layout).state
  return s.z
}

describe('main gate', () => {
  it('the closed barrier stops students outside the campus', () => {
    expect(walkNorth(false)).toBeGreaterThan(GATE_Z)
  })
  it('after verification the open gate lets students walk in', () => {
    expect(walkNorth(true)).toBeLessThan(GATE_Z - 20)
  })
  it('the perimeter wall has no other gap', () => {
    const layout = buildLayout(bounds, [], ENTRANCE_COLLIDERS)
    let s = { x: 30, z: 70, heading: 0 }
    for (let i = 0; i < 400; i++) s = stepPlayer(s, { forward: true, back: false, left: false, right: false, run: false }, 0, 0.05, layout).state
    expect(s.z).toBeGreaterThan(GATE_Z)
  })
})

describe('checkpoint reachable from both sides', () => {
  it('students inside the campus can reach security to leave', async () => {
    const { nearestInteractable } = await import('@nexora/world-engine')
    const layout = buildLayout(bounds, [], ENTRANCE_COLLIDERS, [
      { id: 'npc:guard', kind: 'npc', label: 'x', position: { x: 4, z: 61 }, radius: 3 },
      { id: 'npc:guard', kind: 'npc', label: 'x', position: { x: 3.4, z: 53.6 }, radius: 2.6 },
    ])
    expect(nearestInteractable({ x: 3, z: 54.5 }, layout)?.id).toBe('npc:guard')
    expect(nearestInteractable({ x: 3.5, z: 61.5 }, layout)?.id).toBe('npc:guard')
  })
})

describe('campus characters and time of day', () => {
  it('classmates look the same every launch', () => {
    expect(lookFor('s03', 'F', 'research_scholar')).toEqual(lookFor('s03', 'F', 'research_scholar'))
    expect(lookFor('s03', 'F')).not.toEqual(lookFor('s04', 'M'))
  })
  it('follows the local clock unless overridden', () => {
    expect(phaseFor('auto', new Date(2026, 0, 1, 8))).toBe('morning')
    expect(phaseFor('auto', new Date(2026, 0, 1, 23))).toBe('night')
    expect(phaseFor('evening', new Date(2026, 0, 1, 8))).toBe('evening')
  })
})
