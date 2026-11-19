import { forwardRef, useMemo, useRef } from 'react'
import type { Group } from 'three'
import { useFrame } from '@react-three/fiber'
import { player } from '../../engine/player'
import { Human, type Look } from '../world/Human'

/** The student: a human figure wearing their chosen colours (suit = jacket, visor = accent details). */
export const Avatar = forwardRef<Group, { body: string; accent: string }>(function Avatar({ body, accent }, ref) {
  const motion = useRef(0)
  useFrame((_, dt) => { motion.current += ((player.moving ? 1 : 0) - motion.current) * Math.min(1, dt * 8) })
  const look = useMemo<Look>(() => ({
    skin: '#d9a07a', hair: '#2e1f16', hairStyle: 'short', top: accent, bottom: '#1e293b', shoes: '#f8fafc', height: 1,
    build: 1, glasses: false, backpack: '#1f2937', outer: 'jacket', outerColor: body, cap: null,
  }), [body, accent])
  return (
    <group ref={ref}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[0.45, 0.55, 40]} />
        <meshBasicMaterial color={accent} transparent opacity={0.45} />
      </mesh>
      <Human look={look} motion={motion} />
    </group>
  )
})
