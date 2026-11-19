import { useFrame } from '@react-three/fiber'
import { forwardRef, useRef } from 'react'
import type { Group } from 'three'
import { seededRandom } from '@nexora/world-engine'

/** Clothing and appearance for a procedural adult character. */
export interface Look {
  skin: string; hair: string; hairStyle: 'short' | 'long' | 'bun' | 'bald' | 'curly'
  top: string; bottom: string; shoes: string; height: number; build: number
  glasses: boolean; backpack: string | null; outer: 'none' | 'labcoat' | 'blazer' | 'jacket' | 'uniform'; outerColor: string; cap: string | null
}

const SKIN = ['#f3d7c2', '#e8bfa0', '#d9a07a', '#c68863', '#a86b48', '#8d5a3b', '#6b4430', '#4e3122']
const HAIR = ['#1c1410', '#2e1f16', '#4a3020', '#6b4a2e', '#8a6239', '#b88c5a', '#d8b47a', '#3b3b3b', '#7a1f1f']
const TOPS = ['#f1f5f9', '#1e3a8a', '#166534', '#7c2d12', '#334155', '#be185d', '#0e7490', '#a16207', '#4c1d95', '#e2e8f0', '#0f172a', '#9a3412']
const BOTTOMS = ['#1e293b', '#1e3a5f', '#3f3f46', '#57534e', '#0f172a', '#78716c', '#44403c']

/** Deterministic look for a classmate id - same person, same appearance, every launch. */
export function lookFor(id: string, presentation: 'F' | 'M', archetype?: string): Look {
  let seed = 0
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  const r = seededRandom(seed)
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const styles: Look['hairStyle'][] = presentation === 'F' ? ['long', 'long', 'bun', 'curly', 'short'] : ['short', 'short', 'curly', 'bald', 'long']
  const outer: Look['outer'] = archetype === 'research_scholar' || archetype === 'robotics' ? (r() < 0.6 ? 'labcoat' : 'jacket')
    : archetype === 'startup_founder' ? 'blazer' : r() < 0.3 ? 'jacket' : 'none'
  return {
    skin: pick(SKIN), hair: pick(HAIR), hairStyle: pick(styles), top: pick(TOPS), bottom: pick(BOTTOMS),
    shoes: r() < 0.5 ? '#f8fafc' : '#1f2937', height: (presentation === 'F' ? 0.94 : 1.0) + (r() - 0.5) * 0.1,
    build: presentation === 'F' ? 0.92 : 1.0, glasses: r() < 0.35, backpack: r() < 0.55 ? pick(['#1f2937', '#7f1d1d', '#1e3a8a', '#365314', '#57534e']) : null,
    outer, outerColor: outer === 'labcoat' ? '#f8fafc' : outer === 'blazer' ? pick(['#1f2937', '#312e81', '#3f3f46']) : pick(['#334155', '#14532d', '#78350f', '#0f172a']),
    cap: archetype === 'sports' && r() < 0.5 ? pick(['#b91c1c', '#1d4ed8', '#111827']) : null,
  }
}

/**
 * A human figure built from primitives with realistic proportions (~1.75 m), natural walk cycle
 * and idle breathing. `motion.current` is 0 (idle) .. 1 (walking); animation is skipped by the
 * caller for distant characters (distance-based LOD).
 */
export const Human = forwardRef<Group, { look: Look; motion?: { current: number }; animate?: { current: boolean }; seated?: boolean }>(
  function Human({ look, motion, animate, seated }, ref) {
    const legL = useRef<Group>(null), legR = useRef<Group>(null), armL = useRef<Group>(null), armR = useRef<Group>(null)
    const torso = useRef<Group>(null)
    const phase = useRef(Math.random() * 10)
    useFrame((_, dt) => {
      if (animate && !animate.current) return
      if (seated) { // hips on the bench, thighs forward, hands resting on the lap
        if (legL.current) legL.current.rotation.x = -1.4
        if (legR.current) legR.current.rotation.x = -1.4
        if (armL.current) armL.current.rotation.x = -0.9
        if (armR.current) armR.current.rotation.x = -0.9
        return
      }
      const m = motion?.current ?? 0
      phase.current += dt * (2 + 7 * m)
      const swing = Math.sin(phase.current) * 0.55 * m
      if (legL.current) legL.current.rotation.x = swing
      if (legR.current) legR.current.rotation.x = -swing
      if (armL.current) armL.current.rotation.x = -swing * 0.8
      if (armR.current) armR.current.rotation.x = swing * 0.8
      if (torso.current) torso.current.position.y = m ? Math.abs(Math.sin(phase.current)) * 0.03 : Math.sin(phase.current * 0.4) * 0.006
    })
    const w = look.build
    const coat = look.outer !== 'none'
    const sleeve = coat ? look.outerColor : look.top
    return (
      <group ref={ref} scale={[look.height, look.height, look.height]}>
        {[legL, legR].map((g, i) => (
          <group key={i} ref={g} position={[(i ? -0.1 : 0.1) * w, 0.9, 0]}>
            <mesh position-y={-0.42} castShadow><capsuleGeometry args={[0.075 * w, 0.68, 4, 8]} /><meshStandardMaterial color={look.bottom} roughness={0.85} /></mesh>
            <mesh position={[0, -0.86, 0.05]} castShadow><boxGeometry args={[0.11, 0.08, 0.26]} /><meshStandardMaterial color={look.shoes} roughness={0.6} /></mesh>
          </group>
        ))}
        <group ref={torso}>
          <mesh position-y={0.98}><boxGeometry args={[0.34 * w, 0.18, 0.2]} /><meshStandardMaterial color={look.bottom} roughness={0.85} /></mesh>
          <mesh position-y={1.27} castShadow><capsuleGeometry args={[0.17 * w, 0.32, 4, 10]} /><meshStandardMaterial color={look.top} roughness={0.8} /></mesh>
          {coat && (
            <mesh position-y={look.outer === 'labcoat' ? 1.13 : 1.25} castShadow>
              <cylinderGeometry args={[0.2 * w, look.outer === 'labcoat' ? 0.24 * w : 0.21 * w, look.outer === 'labcoat' ? 0.78 : 0.5, 12, 1, true]} />
              <meshStandardMaterial color={look.outerColor} roughness={0.75} side={2} />
            </mesh>
          )}
          {[armL, armR].map((g, i) => (
            <group key={i} ref={g} position={[(i ? -0.23 : 0.23) * w, 1.47, 0]}>
              <mesh position-y={-0.27} castShadow><capsuleGeometry args={[0.055, 0.46, 4, 8]} /><meshStandardMaterial color={sleeve} roughness={0.8} /></mesh>
              <mesh position-y={-0.58}><sphereGeometry args={[0.05, 8, 6]} /><meshStandardMaterial color={look.skin} roughness={0.7} /></mesh>
            </group>
          ))}
          {look.backpack && (
            <mesh position={[0, 1.25, -0.18]} castShadow><boxGeometry args={[0.3 * w, 0.4, 0.14]} /><meshStandardMaterial color={look.backpack} roughness={0.8} /></mesh>
          )}
          <mesh position-y={1.56}><cylinderGeometry args={[0.05, 0.06, 0.08, 8]} /><meshStandardMaterial color={look.skin} roughness={0.7} /></mesh>
          <mesh position-y={1.7} castShadow><sphereGeometry args={[0.11, 16, 12]} /><meshStandardMaterial color={look.skin} roughness={0.65} /></mesh>
          {[-0.04, 0.04].map((x) => (
            <mesh key={x} position={[x, 1.72, 0.1]}><sphereGeometry args={[0.012, 6, 4]} /><meshStandardMaterial color="#1f2937" /></mesh>
          ))}
          {look.glasses && (
            <mesh position={[0, 1.72, 0.105]}><boxGeometry args={[0.16, 0.035, 0.01]} /><meshStandardMaterial color="#111827" metalness={0.5} /></mesh>
          )}
          <Hair look={look} />
        </group>
      </group>
    )
  })

function Hair({ look }: { look: Look }) {
  const mat = <meshStandardMaterial color={look.hair} roughness={0.9} />
  if (look.cap) return <mesh position-y={1.77}><sphereGeometry args={[0.118, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={look.cap} /></mesh>
  switch (look.hairStyle) {
    case 'bald': return null
    case 'long': return (
      <group>
        <mesh position-y={1.74}><sphereGeometry args={[0.118, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />{mat}</mesh>
        <mesh position={[0, 1.6, -0.05]}><boxGeometry args={[0.22, 0.28, 0.08]} />{mat}</mesh>
      </group>
    )
    case 'bun': return (
      <group>
        <mesh position-y={1.74}><sphereGeometry args={[0.117, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />{mat}</mesh>
        <mesh position={[0, 1.82, -0.07]}><sphereGeometry args={[0.055, 10, 8]} />{mat}</mesh>
      </group>
    )
    case 'curly': return <mesh position-y={1.76}><icosahedronGeometry args={[0.13, 1]} />{mat}</mesh>
    default: return <mesh position-y={1.745}><sphereGeometry args={[0.116, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.45]} />{mat}</mesh>
  }
}
