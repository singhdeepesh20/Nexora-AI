import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import { seededRandom, type Vec2 } from '@nexora/world-engine'
import { player } from '../../engine/player'
import { Human, lookFor } from './Human'

export interface Classmate { id: string; name: string; archetype: string; presentation: 'F' | 'M'; department_name: string }

/** Live positions of moving classmates, so the player rig can offer "Talk" when close. */
export const crowd = new Map<string, Vec2>()
/** The classmate currently in conversation stops walking and faces the student. */
export const talking: { id: string | null } = { id: null }

const ROUTES: Vec2[][] = [
  [{ x: 1.4, z: 53 }, { x: 1.4, z: 14 }],
  [{ x: -1.4, z: 14 }, { x: -1.4, z: 53 }],
  [{ x: -11, z: 3 }, { x: -17.2, z: -2.6 }],
  [{ x: 1, z: -11 }, { x: 1.5, z: -23.6 }],
  [{ x: 11, z: 3 }, { x: 17.2, z: -2.6 }],
  Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (1.12 + (i / 8) * 0.76); return { x: 11 * Math.cos(a), z: 11 * Math.sin(a) } }),
  [{ x: 3.5, z: 24 }, { x: 14, z: 34 }, { x: 24, z: 30 }],
]
const GROUPS: { c: Vec2; n: number }[] = [{ c: { x: 8.5, z: 9 }, n: 3 }, { c: { x: -10.5, z: -8 }, n: 2 }, { c: { x: 9.5, z: -9 }, n: 3 }]
const BENCHES: { x: number; z: number; rot: number }[] = [{ x: 13.6, z: 3, rot: -Math.PI / 2 }, { x: -13.6, z: 3, rot: Math.PI / 2 }, { x: 4.5, z: 26, rot: -Math.PI / 2 }]
const TALK_RADIUS = 2.4

function Walker({ who, route, speed, offset }: { who: Classmate; route: Vec2[]; speed: number; offset: number }) {
  const root = useRef<Group>(null)
  const motion = useRef(0)
  const animate = useRef(true)
  const look = useMemo(() => lookFor(who.id, who.presentation, who.archetype), [who])
  const lengths = useMemo(() => route.slice(1).map((p, i) => Math.hypot(p.x - route[i].x, p.z - route[i].z)), [route])
  const total = lengths.reduce((a, b) => a + b, 0)
  const s = useRef(offset * total * 2)
  const dwell = useRef(0)
  useFrame((_, dt) => {
    const g = root.current
    if (!g) return
    const dx = player.state.x - g.position.x, dz = player.state.z - g.position.z
    const dist = Math.hypot(dx, dz)
    animate.current = dist < 45
    g.visible = dist < 110
    if (talking.id === who.id) {
      motion.current = 0
      g.rotation.y = Math.atan2(dx, dz)
      return
    }
    if (dwell.current > 0) { dwell.current -= dt; motion.current = Math.max(0, motion.current - dt * 4); return }
    const before = s.current
    s.current = (s.current + speed * Math.min(dt, 0.25)) % (total * 2)
    if ((before < total) !== (s.current < total)) dwell.current = 1 + ((offset * 97) % 3) // pause at each end
    const along = s.current < total ? s.current : total * 2 - s.current
    let rem = along, i = 0
    while (i < lengths.length - 1 && rem > lengths[i]) { rem -= lengths[i]; i++ }
    const a = route[i], b = route[i + 1], t = lengths[i] ? rem / lengths[i] : 0
    const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t
    const dir = s.current < total ? Math.atan2(b.x - a.x, b.z - a.z) : Math.atan2(a.x - b.x, a.z - b.z)
    g.position.set(x, 0, z)
    let d = dir - g.rotation.y
    d = Math.atan2(Math.sin(d), Math.cos(d))
    g.rotation.y += d * Math.min(1, dt * 6)
    motion.current = Math.min(1, motion.current + dt * 4) * Math.min(1, speed / 1.3)
    crowd.set(who.id, { x, z })
  })
  return <group ref={root}><Human look={look} motion={motion} animate={animate} /></group>
}

function Idler({ who, pos, face, seated }: { who: Classmate; pos: Vec2; face: number; seated?: boolean }) {
  const root = useRef<Group>(null)
  const animate = useRef(true)
  const look = useMemo(() => lookFor(who.id, who.presentation, who.archetype), [who])
  useFrame(() => {
    const g = root.current
    if (!g) return
    const dx = player.state.x - pos.x, dz = player.state.z - pos.z
    animate.current = Math.hypot(dx, dz) < 40
    g.rotation.y = talking.id === who.id ? Math.atan2(dx, dz) : face
  })
  useMemo(() => crowd.set(who.id, pos), [who.id, pos])
  return (
    <group ref={root} position={[pos.x, seated ? -0.42 : 0, pos.z]}>
      <Human look={look} animate={animate} seated={seated} />
      {seated && <mesh position={[0, 0.98, 0.35]}><boxGeometry args={[0.34, 0.02, 0.24]} /><meshStandardMaterial color="#94a3b8" metalness={0.7} /></mesh>}
    </group>
  )
}

function Bench({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, 0, z]} rotation-y={rot}>
      <mesh position-y={0.45} castShadow><boxGeometry args={[2.2, 0.08, 0.55]} /><meshStandardMaterial color="#8b5e34" roughness={0.9} /></mesh>
      <mesh position={[0, 0.8, -0.25]}><boxGeometry args={[2.2, 0.5, 0.06]} /><meshStandardMaterial color="#8b5e34" roughness={0.9} /></mesh>
      {[-0.95, 0.95].map((dx) => <mesh key={dx} position={[dx, 0.22, 0]}><boxGeometry args={[0.08, 0.44, 0.5]} /><meshStandardMaterial color="#27272a" /></mesh>)}
    </group>
  )
}

/** Allocates classmates to walking routes, chatting groups and benches according to the graphics budget. */
export function Crowd({ classmates, walkers, idlers, near }: { classmates: Classmate[]; walkers: number; idlers: number; near: string | null }) {
  const plan = useMemo(() => {
    const r = seededRandom(11)
    const w = classmates.slice(0, walkers).map((who, i) => ({ who, route: ROUTES[i % ROUTES.length], speed: 1.0 + r() * 0.6, offset: r() }))
    const rest = classmates.slice(walkers, walkers + idlers)
    const idle: { who: Classmate; pos: Vec2; face: number; seated?: boolean }[] = []
    let k = 0
    for (const g of GROUPS) for (let j = 0; j < g.n && k < rest.length; j++, k++) {
      const a = (j / g.n) * Math.PI * 2
      const pos = { x: g.c.x + Math.cos(a) * 0.75, z: g.c.z + Math.sin(a) * 0.75 }
      idle.push({ who: rest[k], pos, face: Math.atan2(g.c.x - pos.x, g.c.z - pos.z) })
    }
    for (const b of BENCHES) for (const off of [-0.5, 0.5]) {
      if (k >= rest.length) break
      const ox = Math.cos(b.rot) * off, oz = -Math.sin(b.rot) * off
      idle.push({ who: rest[k++], pos: { x: b.x + ox + Math.sin(b.rot) * 0.1, z: b.z + oz + Math.cos(b.rot) * 0.1 }, face: b.rot, seated: true })
    }
    return { w, idle }
  }, [classmates, walkers, idlers])
  const nearId = near?.startsWith('student:') ? near.slice(8) : null
  const nearWho = classmates.find((c) => c.id === nearId)
  const nearPos = nearId ? crowd.get(nearId) : undefined
  return (
    <group>
      {BENCHES.map((b, i) => <Bench key={i} {...b} />)}
      {plan.w.map((p) => <Walker key={p.who.id} {...p} />)}
      {plan.idle.map((p) => <Idler key={p.who.id} {...p} />)}
      {nearWho && nearPos && (
        <Html position={[nearPos.x, 2.25, nearPos.z]} center distanceFactor={10} zIndexRange={[10, 0]}>
          <div className="pointer-events-none select-none whitespace-nowrap rounded-md border border-[#22c55e66] bg-[rgba(13,17,23,.82)] px-2 py-0.5 text-[11px]">
            <b className="text-white">{nearWho.name}</b> <span className="text-green-300">· {nearWho.department_name}</span>
          </div>
        </Html>
      )}
    </group>
  )
}

/** Nearest classmate within talking range (dynamic positions), or null. */
export function nearestClassmate(p: Vec2): string | null {
  let best: string | null = null, bd = TALK_RADIUS
  for (const [id, q] of crowd) {
    const d = Math.hypot(p.x - q.x, p.z - q.z)
    if (d < bd) { bd = d; best = id }
  }
  return best
}
