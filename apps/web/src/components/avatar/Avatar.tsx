import { useFrame } from '@react-three/fiber'
import { forwardRef, useRef } from 'react'
import type { Group } from 'three'
import { player } from '../../engine/player'

/** Stylised student avatar built from primitives; limbs swing procedurally while walking. */
export const Avatar = forwardRef<Group, { body: string; accent: string }>(function Avatar({ body, accent }, ref) {
  const legL = useRef<Group>(null), legR = useRef<Group>(null), armL = useRef<Group>(null), armR = useRef<Group>(null)
  const bob = useRef<Group>(null)
  const phase = useRef(0)
  useFrame((_, dt) => {
    const speed = player.moving ? 9 : 0
    phase.current += dt * speed
    const target = player.moving ? Math.sin(phase.current) * 0.6 : 0
    for (const [r, s] of [[legL, 1], [legR, -1], [armL, -0.8], [armR, 0.8]] as const) {
      if (r.current) r.current.rotation.x += (target * s - r.current.rotation.x) * Math.min(1, dt * 12)
    }
    if (bob.current) bob.current.position.y = player.moving ? Math.abs(Math.sin(phase.current)) * 0.06 : 0
  })
  return (
    <group ref={ref}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[0.55, 0.68, 40]} />
        <meshBasicMaterial color={accent} transparent opacity={0.55} />
      </mesh>
      <group ref={bob}>
        {[legL, legR].map((r, i) => (
          <group key={i} ref={r} position={[i ? -0.17 : 0.17, 0.85, 0]}>
            <mesh position-y={-0.4} castShadow>
              <capsuleGeometry args={[0.11, 0.55, 4, 10]} />
              <meshStandardMaterial color="#1f2937" roughness={0.7} />
            </mesh>
          </group>
        ))}
        <mesh position-y={1.3} castShadow>
          <capsuleGeometry args={[0.32, 0.5, 6, 16]} />
          <meshStandardMaterial color={body} roughness={0.45} metalness={0.1} />
        </mesh>
        <mesh position={[0, 1.35, -0.3]} castShadow>
          <boxGeometry args={[0.42, 0.5, 0.18]} />
          <meshStandardMaterial color="#111827" roughness={0.6} />
        </mesh>
        {[armL, armR].map((r, i) => (
          <group key={i} ref={r} position={[i ? -0.43 : 0.43, 1.6, 0]}>
            <mesh position-y={-0.32} castShadow>
              <capsuleGeometry args={[0.09, 0.45, 4, 10]} />
              <meshStandardMaterial color={body} roughness={0.45} />
            </mesh>
          </group>
        ))}
        <mesh position-y={2.02} castShadow>
          <sphereGeometry args={[0.27, 24, 18]} />
          <meshStandardMaterial color="#e5e7eb" roughness={0.3} metalness={0.2} />
        </mesh>
        <mesh position={[0, 2.04, 0.17]} rotation-x={-0.1}>
          <boxGeometry args={[0.34, 0.12, 0.14]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} roughness={0.2} />
        </mesh>
      </group>
    </group>
  )
})
