import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh, MeshStandardMaterial } from 'three'
import type { District } from '@nexora/shared-types'

/** Procedural modern glass academic building. Doors face the central plaza. */
/** `mastery` (0-1) is the verified fraction of this district's concepts the student has mastered. */
export function Building({ district, highlighted, mastery = 0 }: { district: District; highlighted: boolean; mastery?: number }) {
  const { x, z, w, d, h, door, label } = district.building
  const c = district.color
  const portal = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    const m = portal.current?.material as MeshStandardMaterial | undefined
    if (m) m.emissiveIntensity = (highlighted ? 2.2 : 1.1) + Math.sin(clock.elapsedTime * 2.2) * 0.35
  })
  // door direction relative to building centre
  const dx = door.x - x, dz = door.z - z
  const facingX = Math.abs(dx) > Math.abs(dz)
  const doorRot = facingX ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dz > 0 ? 0 : Math.PI)
  const floors = Math.max(2, Math.floor(h / 3.2))
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.25} receiveShadow castShadow>
        <boxGeometry args={[w + 1.6, 0.5, d + 1.6]} />
        <meshStandardMaterial color="#3b434c" roughness={0.9} />
      </mesh>
      <mesh position-y={h / 2 + 0.5} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#27515f" roughness={0.12} metalness={0.35} />
      </mesh>
      {Array.from({ length: floors }, (_, i) => (
        <mesh key={i} position-y={0.5 + ((i + 1) * h) / (floors + 1)}>
          <boxGeometry args={[w + 0.06, 0.16, d + 0.06]} />
          <meshStandardMaterial color="#d7e3ea" roughness={0.4} emissive={c} emissiveIntensity={0.15} />
        </mesh>
      ))}
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <mesh key={`${sx}${sz}`} position={[(sx * w) / 2, h / 2 + 0.5, (sz * d) / 2]} castShadow>
          <boxGeometry args={[0.35, h, 0.35]} />
          <meshStandardMaterial color="#e5edf2" roughness={0.5} />
        </mesh>
      )))}
      <mesh position-y={h + 0.75} castShadow>
        <boxGeometry args={[w + 2, 0.5, d + 2]} />
        <meshStandardMaterial color="#e8eef2" roughness={0.6} />
      </mesh>
      <mesh position-y={h + 0.48}>
        <boxGeometry args={[w + 2.05, 0.08, d + 2.05]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.5} />
      </mesh>
      {district.number === 2 && (
        <mesh position-y={h + 2.4} rotation-x={Math.PI / 2}>
          <torusGeometry args={[Math.min(w, d) / 3, 0.18, 12, 64]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.2} />
        </mesh>
      )}
      {district.number === 3 && (
        <mesh position-y={h + 1}>
          <sphereGeometry args={[Math.min(w, d) / 3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#9fb7c4" roughness={0.15} metalness={0.5} />
        </mesh>
      )}
      {district.number === 1 && (
        <mesh position={[-w / 2 + 1.5, h + 3, -d / 2 + 1.5]} castShadow>
          <boxGeometry args={[3, 5, 3]} />
          <meshStandardMaterial color="#2f6272" roughness={0.15} metalness={0.35} />
        </mesh>
      )}
      <group position={[dx, 0, dz]} rotation-y={doorRot}>
        <mesh ref={portal} position={[0, 1.9, -0.75]}>
          <boxGeometry args={[2.6, 3.4, 0.1]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.2} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 3.75, -0.6]}>
          <boxGeometry args={[3.4, 0.3, 0.5]} />
          <meshStandardMaterial color="#f1f5f9" />
        </mesh>
        <Html position={[0, 5.4, -0.5]} center distanceFactor={16} zIndexRange={[10, 0]}>
          <div className="pointer-events-none select-none whitespace-nowrap rounded-lg border px-3 py-1.5 text-center"
            style={{ borderColor: `${c}66`, background: 'rgba(13,17,23,.78)', boxShadow: highlighted ? `0 0 24px ${c}88` : undefined }}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: c }}>District 0{district.number}</div>
            <div className="text-sm font-semibold text-white">{label}</div>
          </div>
        </Html>
      </group>
    </group>
  )
}

/** Planned district: a gate pavilion with a holographic emblem. Not enterable yet. */
export function Gate({ district, highlighted }: { district: District; highlighted: boolean }) {
  const { x, z, w, d, h, label } = district.building
  const holo = useRef<Mesh>(null)
  useFrame((_, dt) => {
    if (holo.current) {
      holo.current.rotation.y += dt * 0.5
      holo.current.rotation.x += dt * 0.2
    }
  })
  const c = district.color
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.2} receiveShadow>
        <cylinderGeometry args={[Math.max(w, d) / 1.6, Math.max(w, d) / 1.5, 0.4, 6]} />
        <meshStandardMaterial color="#353d46" roughness={0.9} />
      </mesh>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <mesh key={`${sx}${sz}`} position={[(sx * w) / 2.4, h / 2, (sz * d) / 2.4]} castShadow>
          <cylinderGeometry args={[0.28, 0.28, h, 12]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.5} />
        </mesh>
      )))}
      <mesh position-y={h} castShadow>
        <boxGeometry args={[w, 0.4, d]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
      </mesh>
      <mesh ref={holo} position-y={h / 2 + 0.3}>
        <icosahedronGeometry args={[1.3, 1]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={highlighted ? 2.2 : 1.2} wireframe />
      </mesh>
      <Html position={[0, h + 1.6, 0]} center distanceFactor={18} zIndexRange={[10, 0]}>
        <div className="pointer-events-none select-none whitespace-nowrap rounded-lg border px-3 py-1 text-center"
          style={{ borderColor: `${c}55`, background: 'rgba(13,17,23,.72)' }}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: c }}>District 0{district.number} · Opening soon</div>
          <div className="text-sm font-semibold text-white">{label.replace(' Gate', '')}</div>
        </div>
      </Html>
    </group>
  )
}
