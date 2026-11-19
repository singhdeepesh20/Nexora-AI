import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, type Group, type Mesh, type MeshStandardMaterial, type Points } from 'three'
import { player } from '../../engine/player'
import { type MachineState, machineState, prefersReducedMotion, subscribeSimEvents, triggerShake } from '../../engine/simEvents'

export interface NpcSpec { id: string; name: string; role: string; color: string; x: number; z: number }

export const MACHINE = { x: -7, z: 7.5 }  // left of the plaza so it stays visible beside the docked onboarding panel
export const NPCS: NpcSpec[] = [
  { id: 'nova', name: 'Professor Nova', role: 'Welcome guide', color: '#f472b6', x: -3.4, z: 11.5 },
  { id: 'atlas', name: 'Professor Atlas', role: 'Mathematics', color: '#2dd4bf', x: -16.6, z: -8.2 },
  { id: 'newton', name: 'Professor Newton', role: 'Machine Learning', color: '#38bdf8', x: 4.2, z: -23.6 },
  { id: 'neural', name: 'Professor Neural', role: 'Deep Learning', color: '#a78bfa', x: 16.6, z: -8.2 },
]

/** Professor character: idles, floats, and turns to face the student when nearby. */
export function Professor({ npc, highlighted }: { npc: NpcSpec; highlighted: boolean }) {
  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  const offset = useMemo(() => npc.x * 0.37, [npc.x])
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + offset
    if (body.current) body.current.position.y = Math.sin(t * 1.6) * 0.06
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
        <meshBasicMaterial color={npc.color} transparent opacity={highlighted ? 0.9 : 0.4} />
      </mesh>
      <group ref={body}>
        <mesh position-y={0.95} castShadow>
          <coneGeometry args={[0.55, 1.5, 20]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.5} />
        </mesh>
        <mesh position-y={1.55} castShadow>
          <capsuleGeometry args={[0.3, 0.35, 4, 14]} />
          <meshStandardMaterial color={npc.color} roughness={0.4} />
        </mesh>
        <mesh position-y={2.15} castShadow>
          <sphereGeometry args={[0.26, 20, 16]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.3} metalness={0.2} />
        </mesh>
        <mesh position={[0, 2.17, 0.2]}>
          <boxGeometry args={[0.32, 0.09, 0.1]} />
          <meshStandardMaterial color={npc.color} emissive={npc.color} emissiveIntensity={1.5} />
        </mesh>
        <mesh position-y={2.62} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.24, 0.03, 8, 32]} />
          <meshStandardMaterial color={npc.color} emissive={npc.color} emissiveIntensity={highlighted ? 2.4 : 1} />
        </mesh>
      </group>
      <Html position={[0, 3.15, 0]} center distanceFactor={11} zIndexRange={[10, 0]}>
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

