import { describe, expect, it } from 'vitest'
import {
  type DistrictSpec, type MoveInput, PLAYER_RADIUS, WALK_SPEED, buildLayout, circleIntersectsBox,
  moveDirection, nearestInteractable, scatterTrees, seededRandom, stepPlayer,
} from './index'

const idle: MoveInput = { forward: false, back: false, left: false, right: false, run: false }
const districts: DistrictSpec[] = [
  { id: 'foundation', number: 1, title: 'F', status: 'active', color: '#fff',
    building: { x: 0, z: -10, w: 10, d: 6, h: 8, door: { x: 0, z: -6.2 }, label: 'Hall' } },
  { id: 'genai', number: 4, title: 'G', status: 'planned', color: '#fff',
    building: { x: 20, z: 0, w: 6, d: 6, h: 5, door: { x: 16, z: 0 }, label: 'Gate' } },
]
const layout = buildLayout({ min_x: -30, max_x: 30, min_z: -30, max_z: 30 }, districts)

describe('movement', () => {
  it('moves forward relative to camera yaw', () => {
    const d = moveDirection({ ...idle, forward: true }, 0)!
    expect(d.x).toBeCloseTo(0)
    expect(d.z).toBeCloseTo(-1)
    const r = moveDirection({ ...idle, forward: true }, Math.PI / 2)!
    expect(r.x).toBeCloseTo(-1)
  })

  it('normalises diagonal movement', () => {
    const d = moveDirection({ ...idle, forward: true, right: true }, 0)!
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(1)
  })

  it('walks and runs at the configured speed', () => {
    const s0 = { x: 0, z: 10, heading: 0 }
    const walk = stepPlayer(s0, { ...idle, forward: true }, 0, 0.05, layout)
    expect(10 - walk.state.z).toBeCloseTo(WALK_SPEED * 0.05)
    const run = stepPlayer(s0, { ...idle, forward: true, run: true }, 0, 0.05, layout)
    expect(10 - run.state.z).toBeGreaterThan(10 - walk.state.z)
  })

  it('sub-steps long frames: real-time speed on slow machines, no tunnelling', () => {
    const s0 = { x: 0, z: 10, heading: 0 }
    const slow = stepPlayer(s0, { ...idle, forward: true }, 0, 0.2, layout) // a 5 FPS frame
    expect(10 - slow.state.z).toBeCloseTo(WALK_SPEED * 0.2)
    const hitch = stepPlayer({ x: 0, z: -5, heading: 0 }, { ...idle, forward: true, run: true }, 0, 10, layout)
    expect(hitch.state.z).toBeGreaterThan(-7 + PLAYER_RADIUS)
    const thin = buildLayout(layout.bounds, [], [{ minX: -5, maxX: 5, minZ: 4.9, maxZ: 5.1 }])
    const r = stepPlayer({ x: 0, z: 6, heading: 0 }, { ...idle, forward: true, run: true }, 0, 0.25, thin)
    expect(r.state.z).toBeGreaterThan(5.1)
  })

  it('is idle without input', () => {
    const s0 = { x: 1, z: 1, heading: 0.3 }
    expect(stepPlayer(s0, idle, 0, 0.016, layout)).toEqual({ state: s0, moving: false })
  })
})

describe('collision', () => {
  it('detects circle-box overlap', () => {
    expect(circleIntersectsBox({ x: 0, z: -6.5 }, 0.6, { minX: -5, maxX: 5, minZ: -13, maxZ: -7 })).toBe(true)
    expect(circleIntersectsBox({ x: 0, z: -5 }, 0.6, { minX: -5, maxX: 5, minZ: -13, maxZ: -7 })).toBe(false)
  })

  it('stops at a building wall and never enters it', () => {
    let s = { x: 0, z: 0, heading: 0 }
    for (let i = 0; i < 400; i++) s = stepPlayer(s, { ...idle, forward: true }, 0, 0.016, layout).state
    expect(s.z).toBeGreaterThanOrEqual(-7 + PLAYER_RADIUS - 1e-9)
  })

  it('slides along walls when moving diagonally', () => {
    let s = { x: 0, z: -6.4, heading: 0 }
    const start = s.x
    for (let i = 0; i < 30; i++) s = stepPlayer(s, { ...idle, forward: true, right: true }, 0, 0.016, layout).state
    expect(s.x).toBeGreaterThan(start + 1)
  })

  it('keeps the player inside world bounds', () => {
    let s = { x: 29, z: 0, heading: 0 }
    for (let i = 0; i < 200; i++) s = stepPlayer(s, { ...idle, right: true }, 0, 0.016, layout).state
    expect(s.x).toBeLessThanOrEqual(30 - PLAYER_RADIUS)
  })
})

describe('interaction', () => {
  it('finds the building whose door is in range', () => {
    expect(nearestInteractable({ x: 0.5, z: -4 }, layout)?.id).toBe('foundation')
    expect(nearestInteractable({ x: 16.5, z: 1 }, layout)?.kind).toBe('gate')
    expect(nearestInteractable({ x: 0, z: 20 }, layout)).toBeNull()
  })
})

describe('scenery', () => {
  it('is deterministic and avoids buildings', () => {
    const r1 = seededRandom(3), r2 = seededRandom(3)
    expect([r1(), r1()]).toEqual([r2(), r2()])
    const trees = scatterTrees(40, layout.bounds, layout.colliders, 10, 1)
    expect(trees).toEqual(scatterTrees(40, layout.bounds, layout.colliders, 10, 1))
    for (const t of trees) for (const b of layout.colliders) expect(circleIntersectsBox(t, 3.9, b)).toBe(false)
  })
})
