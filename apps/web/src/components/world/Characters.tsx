import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, type Group, type Mesh, type MeshStandardMaterial, type Points } from 'three'
import { player } from '../../engine/player'
import { Human, lookFor } from './Human'
import { type MachineState, machineState, prefersReducedMotion, subscribeSimEvents, triggerShake } from '../../engine/simEvents'

export interface NpcSpec { id: string; name: string; role: string; color: string; x: number; z: number; presentation: 'F' | 'M' }

export const MACHINE = { x: -7, z: 7.5 }  // left of the plaza so it stays visible beside the docked onboarding panel
export const NPCS: NpcSpec[] = [
  { id: 'nova', name: 'Professor Nova', role: 'Welcome guide', color: '#f472b6', x: -3.4, z: 11.5, presentation: 'F' },
  { id: 'atlas', name: 'Professor Atlas', role: 'Mathematics', color: '#2dd4bf', x: -16.6, z: -8.2, presentation: 'M' },
  { id: 'newton', name: 'Professor Newton', role: 'Machine Learning', color: '#38bdf8', x: 4.2, z: -23.6, presentation: 'M' },
  { id: 'neural', name: 'Professor Neural', role: 'Deep Learning', color: '#a78bfa', x: 16.6, z: -8.2, presentation: 'F' },
]

/** Professor character: idles, floats, and turns to face the student when nearby. */
export function Professor({ npc, highlighted }: { npc: NpcSpec; highlighted: boolean }) {
  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  const offset = useMemo(() => npc.x * 0.37, [npc.x])
  // Faculty dress: a blazer over a shirt; deterministic per professor.
  const look = useMemo(() => ({ ...lookFor(`prof-${npc.id}`, npc.presentation, 'startup_founder'), outer: 'blazer' as const, backpack: null, cap: null, glasses: npc.id === 'atlas' || npc.id === 'neural' }), [npc])
  const animate = useRef(true)
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + offset
    if (body.current) body.current.position.y = 0
    if (root.current) {
      const dx = player.state.x - npc.x, dz = player.state.z - npc.z
      const near = dx * dx + dz * dz < 100
      const target = near ? Math.atan2(dx, dz) : Math.sin(t * 0.3) * 0.6
      let d = target - root.current.rotation.y
      d = Math.atan2(Math.sin(d), Math.cos(d))
      root.current.rotation.y += d * Math.min(1, dt * 4)
    }
  })
  return (
    <group ref={root} position={[npc.x, 0, npc.z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
        <ringGeometry args={[0.6, 0.75, 32]} />
        <meshBasicMaterial color={npc.color} transparent opacity={0.8} visible={highlighted} />
      </mesh>
      <group ref={body}>
        <Human look={look} animate={animate} />
      </group>
      <Html position={[0, 2.3, 0]} center distanceFactor={11} zIndexRange={[10, 0]}>
        <div className="pointer-events-none select-none whitespace-nowrap rounded-md px-2 py-0.5 text-center text-[11px]"
          style={{ background: 'rgba(13,17,23,.8)', border: `1px solid ${npc.color}66` }}>
          <b className="text-white">{npc.name}</b> <span style={{ color: npc.color }}>· {npc.role}</span>
        </div>
      </Html>
    </group>
  )
}

const STATE_COLOR: Record<MachineState, string> = { idle: '#2dd4bf', success: '#2dd4bf', warning: '#facc15', critical: '#ef4444' }
const STATE_LABEL: Record<MachineState, string> = { idle: 'Ready', success: 'Stable', warning: 'Warning', critical: 'FAILURE' }
const SPARKS = 70

/**
 * The plaza Experiment Machine. It only visualises the classified events of the student's latest
 * real experiment (via the event bus) - it never decides anything itself.
 */
export function ExperimentMachine({ highlighted, reducedMotion }: { highlighted: boolean; reducedMotion?: boolean }) {
  const [state, setState] = useState<MachineState>(machineState())
  const core = useRef<Mesh>(null)
  const lamps = useRef<Group>(null)
  const sparks = useRef<Points>(null)
  const reduce = prefersReducedMotion(reducedMotion)
  useEffect(() => subscribeSimEvents((_ev, s) => {
    setState(s)
    if (s === 'critical' && !reduce) triggerShake(0.35)
  }), [reduce])

  const { geometry, velocities } = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(SPARKS * 3), 3))
    return { geometry: g, velocities: new Float32Array(SPARKS * 3) }
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry]) // free GPU buffers on unmount

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const color = STATE_COLOR[state]
    const m = core.current?.material as MeshStandardMaterial | undefined
    if (m) {
      m.color.set(color)
      m.emissive.set(color)
      const pulse = state === 'critical' && !reduce ? 1.4 + Math.abs(Math.sin(t * 8)) * 2 : state === 'success' ? 2.2 : 1.2
      m.emissiveIntensity = pulse
    }
    if (core.current && !reduce) core.current.rotation.y += dt * (state === 'critical' ? 4 : 0.6)
    lamps.current?.children.forEach((c, i) => {
      const lm = (c as Mesh).material as MeshStandardMaterial
      lm.emissive.set(color)
      lm.emissiveIntensity = state === 'critical' ? (reduce ? 2 : (Math.floor(t * 4 + i) % 2) * 3) : state === 'warning' ? 1.5 : 0.6
    })
    const pts = sparks.current
    if (!pts) return
    pts.visible = state === 'critical' && !reduce
    if (!pts.visible) return
    const pos = geometry.getAttribute('position') as BufferAttribute
    for (let i = 0; i < SPARKS; i++) {
      let y = pos.getY(i)
      if (y <= 0.05 || velocities[i * 3 + 1] === 0) {
        pos.setXYZ(i, 0, 2.2, 0)
        velocities[i * 3] = (Math.random() - 0.5) * 4
        velocities[i * 3 + 1] = 2 + Math.random() * 3
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 4
        y = 2.2
      }
      velocities[i * 3 + 1] -= 9.8 * dt
      pos.setXYZ(i, pos.getX(i) + velocities[i * 3] * dt, Math.max(0.04, y + velocities[i * 3 + 1] * dt), pos.getZ(i) + velocities[i * 3 + 2] * dt)
    }
    pos.needsUpdate = true
  })
  return (
    <group position={[MACHINE.x, 0, MACHINE.z]}>
      <mesh position-y={0.4} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.8, 2.4]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position-y={1.6}>
        <cylinderGeometry args={[0.75, 0.75, 1.6, 24, 1, true]} />
        <meshStandardMaterial color="#bae6fd" transparent opacity={0.18} roughness={0.05} />
      </mesh>
      <mesh ref={core} position-y={1.6}>
        <octahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial color="#2dd4bf" emissive="#2dd4bf" emissiveIntensity={1.2} />
      </mesh>
      <mesh position-y={2.5}>
        <cylinderGeometry args={[0.9, 0.9, 0.2, 24]} />
        <meshStandardMaterial color="#334155" metalness={0.6} />
      </mesh>
      <group ref={lamps}>
        {[[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.95, z]}>
            <sphereGeometry args={[0.13, 10, 8]} />
            <meshStandardMaterial color="#0f172a" emissive="#2dd4bf" emissiveIntensity={0.6} />
          </mesh>
        ))}
      </group>
      <points ref={sparks} geometry={geometry} visible={false}>
        <pointsMaterial color="#fbbf24" size={0.12} transparent opacity={0.95} blending={AdditiveBlending} depthWrite={false} />
      </points>
      <Html position={[0, 3.3, 0]} center distanceFactor={11} zIndexRange={[10, 0]}>
        <div className="pointer-events-none select-none whitespace-nowrap rounded-md px-2 py-0.5 text-center text-[11px]"
          style={{ background: 'rgba(13,17,23,.85)', border: `1px solid ${STATE_COLOR[state]}`, boxShadow: highlighted ? `0 0 16px ${STATE_COLOR[state]}` : undefined }}>
          <b className="text-white">Experiment Machine</b>{' '}
          <span style={{ color: STATE_COLOR[state] }}>{state === 'critical' ? '⚠ ' : ''}{STATE_LABEL[state]}</span>
        </div>
      </Html>
    </group>
  )
}
