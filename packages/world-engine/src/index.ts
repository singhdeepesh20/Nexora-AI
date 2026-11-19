/**
 * NEXORA world engine - renderer-independent game logic.
 *
 * Pure functions only (no Three.js, no DOM) so movement, collision and interaction
 * rules are deterministic and unit-testable, and could later run on a server for
 * multiplayer validation.
 *
 * Conventions: the ground is the XZ plane. Camera yaw 0 looks toward -Z.
 */

export interface Vec2 { x: number; z: number }
export interface Box { minX: number; maxX: number; minZ: number; maxZ: number }
export interface Bounds { min_x: number; max_x: number; min_z: number; max_z: number }

export interface BuildingSpec {
  x: number; z: number; w: number; d: number; h: number
  door: Vec2
  label: string
}

export interface DistrictSpec {
  id: string
  number: number
  title: string
  status: 'active' | 'planned'
  color: string
  building: BuildingSpec
}

export interface Interactable {
  id: string
  kind: 'building' | 'gate' | 'npc' | 'machine'
  label: string
  position: Vec2
  radius: number
}

export interface WorldLayout {
  bounds: Bounds
  colliders: Box[]
  interactables: Interactable[]
}

export interface PlayerState { x: number; z: number; heading: number }
export interface MoveInput { forward: boolean; back: boolean; left: boolean; right: boolean; run: boolean }

export const PLAYER_RADIUS = 0.55
export const WALK_SPEED = 5.5
export const RUN_SPEED = 10
export const INTERACT_RADIUS = 3.6

export function buildingBox(b: BuildingSpec): Box {
  return { minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 }
}

export function buildLayout(
  bounds: Bounds, districts: DistrictSpec[], extraColliders: Box[] = [], extraInteractables: Interactable[] = [],
): WorldLayout {
  return {
    bounds,
    colliders: [...districts.map((d) => buildingBox(d.building)), ...extraColliders],
    interactables: districts.map((d) => ({
      id: d.id,
      kind: d.status === 'active' ? 'building' : 'gate',
      label: d.building.label,
      position: d.building.door,
      radius: INTERACT_RADIUS,
    })),
  }
}

/** True if a circle overlaps an axis-aligned box. */
export function circleIntersectsBox(p: Vec2, r: number, b: Box): boolean {
  const cx = Math.max(b.minX, Math.min(p.x, b.maxX))
  const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ))
  const dx = p.x - cx
  const dz = p.z - cz
  return dx * dx + dz * dz < r * r
}

export function collides(p: Vec2, r: number, boxes: Box[]): boolean {
  return boxes.some((b) => circleIntersectsBox(p, r, b))
}

/** Camera-relative movement direction (unit vector) or null when idle. */
export function moveDirection(input: MoveInput, cameraYaw: number): Vec2 | null {
  const f = (input.forward ? 1 : 0) - (input.back ? 1 : 0)
  const s = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  if (f === 0 && s === 0) return null
  // forward vector for yaw: (-sin, -cos); right vector: (cos, -sin)
  const fx = -Math.sin(cameraYaw), fz = -Math.cos(cameraYaw)
  const rx = Math.cos(cameraYaw), rz = -Math.sin(cameraYaw)
  const x = f * fx + s * rx
  const z = f * fz + s * rz
  const len = Math.hypot(x, z)
  return { x: x / len, z: z / len }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Advance the player by dt seconds. Axis-separated resolution gives natural sliding along walls.
 * Large frames are split into sub-steps of at most MAX_SUBSTEP so slow laptops keep real-time
 * speed without tunnelling through thin colliders; frames longer than MAX_FRAME (tab switches,
 * hitches) are clamped.
 */
export const MAX_SUBSTEP = 0.05
export const MAX_FRAME = 0.25

export function stepPlayer(
  state: PlayerState, input: MoveInput, cameraYaw: number, dt: number, layout: WorldLayout,
): { state: PlayerState; moving: boolean } {
  const dir = moveDirection(input, cameraYaw)
  if (!dir) return { state, moving: false }
  const speed = input.run ? RUN_SPEED : WALK_SPEED
  const { bounds, colliders } = layout
  let { x, z } = state
  let remaining = Math.min(Math.max(dt, 0), MAX_FRAME)
  while (remaining > 1e-9) {
    const h = Math.min(remaining, MAX_SUBSTEP)
    remaining -= h
    const step = speed * h
    const nx = clamp(x + dir.x * step, bounds.min_x + PLAYER_RADIUS, bounds.max_x - PLAYER_RADIUS)
    if (!collides({ x: nx, z }, PLAYER_RADIUS, colliders)) x = nx
    const nz = clamp(z + dir.z * step, bounds.min_z + PLAYER_RADIUS, bounds.max_z - PLAYER_RADIUS)
    if (!collides({ x, z: nz }, PLAYER_RADIUS, colliders)) z = nz
  }
  const heading = Math.atan2(dir.x, dir.z)
  return { state: { x, z, heading }, moving: x !== state.x || z !== state.z }
}

export function nearestInteractable(p: Vec2, layout: WorldLayout): Interactable | null {
  let best: Interactable | null = null
  let bestD = Infinity
  for (const it of layout.interactables) {
    const d = Math.hypot(p.x - it.position.x, p.z - it.position.z)
    if (d <= it.radius && d < bestD) {
      best = it
      bestD = d
    }
  }
  return best
}

/** Deterministic pseudo-random generator (mulberry32) for reproducible scenery placement. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Place trees away from buildings, the plaza and the main paths. */
export function scatterTrees(count: number, bounds: Bounds, avoid: Box[], plazaRadius: number, seed = 7): Vec2[] {
  const rnd = seededRandom(seed)
  const out: Vec2[] = []
  let guard = 0
  while (out.length < count && guard++ < count * 40) {
    const p = { x: bounds.min_x + 4 + rnd() * (bounds.max_x - bounds.min_x - 8), z: bounds.min_z + 4 + rnd() * (bounds.max_z - bounds.min_z - 8) }
    if (Math.hypot(p.x, p.z) < plazaRadius + 6) continue
    if (Math.abs(p.x) < 4 || Math.abs(p.z + 4) < 3) continue // keep main avenues clear
    if (avoid.some((b) => circleIntersectsBox(p, 4, b))) continue
    if (out.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 3)) continue
    out.push(p)
  }
  return out
}

export function treeCollider(p: Vec2): Box {
  return { minX: p.x - 0.45, maxX: p.x + 0.45, minZ: p.z - 0.45, maxZ: p.z + 0.45 }
}
