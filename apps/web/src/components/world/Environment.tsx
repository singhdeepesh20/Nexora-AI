import { Sky } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, Object3D, type InstancedMesh, type Mesh } from 'three'
import type { Vec2 } from '@nexora/world-engine'
import type { District } from '@nexora/shared-types'
import type { GraphicsConfig } from '../../engine/graphics'

export function Lighting({ g }: { g: GraphicsConfig }) {
  return (
    <>
      <hemisphereLight args={['#bfe3ff', '#3d5a35', 0.9]} />
      <directionalLight
        position={[40, 60, 25]} intensity={2.1} castShadow={g.shadows}
        shadow-mapSize={[g.shadowMapSize, g.shadowMapSize]} shadow-bias={-0.0004}
        shadow-camera-left={-80} shadow-camera-right={80} shadow-camera-top={80} shadow-camera-bottom={-80}
        shadow-camera-near={1} shadow-camera-far={200}
      />
      {g.sky ? <Sky sunPosition={[40, 60, 25]} turbidity={6} rayleigh={1.2} mieCoefficient={0.004} /> : <color attach="background" args={['#9ccbe8']} />}
      <fog attach="fog" args={['#b9d8ea', 70, 190]} />
    </>
  )
}

export function Ground({ plazaRadius, districts }: { plazaRadius: number; districts: District[] }) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#4d7a3a" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} receiveShadow>
        <circleGeometry args={[plazaRadius, 64]} />
        <meshStandardMaterial color="#8f99a3" roughness={0.85} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
        <ringGeometry args={[plazaRadius - 0.5, plazaRadius - 0.25, 96]} />
        <meshStandardMaterial color="#2dd4bf" emissive="#2dd4bf" emissiveIntensity={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
        <ringGeometry args={[5, 5.2, 64]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.7} />
      </mesh>
      {districts.map((d) => <Path key={d.id} to={d.building.door} active={d.status === 'active'} />)}
      <Path to={{ x: 0, z: 44 }} active />
    </group>
  )
}

function Path({ to, active }: { to: Vec2; active: boolean }) {
  const len = Math.hypot(to.x, to.z)
  const angle = Math.atan2(to.x, to.z)
  return (
    <group rotation-y={angle}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, len / 2]} receiveShadow>
        <planeGeometry args={[active ? 4.2 : 3, len]} />
        <meshStandardMaterial color={active ? '#a3acb5' : '#8a929a'} roughness={0.9} />
      </mesh>
    </group>
  )
}

export function Trees({ positions }: { positions: Vec2[] }) {
  const trunks = useRef<InstancedMesh>(null)
  const crowns = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const o = new Object3D()
    const col = new Color()
    positions.forEach((p, i) => {
      const s = 0.8 + ((i * 37) % 10) / 20
      o.position.set(p.x, 1.1 * s, p.z)
      o.scale.set(s, s, s)
      o.rotation.set(0, i, 0)
      o.updateMatrix()
      trunks.current!.setMatrixAt(i, o.matrix)
      o.position.set(p.x, 3.1 * s, p.z)
      o.scale.set(s * 1.25, s * 1.45, s * 1.25)
      o.updateMatrix()
      crowns.current!.setMatrixAt(i, o.matrix)
      crowns.current!.setColorAt(i, col.setHSL(0.27 + ((i * 13) % 10) / 120, 0.45, 0.28 + ((i * 7) % 10) / 90))
    })
    trunks.current!.instanceMatrix.needsUpdate = true
    crowns.current!.instanceMatrix.needsUpdate = true
    if (crowns.current!.instanceColor) crowns.current!.instanceColor.needsUpdate = true
  }, [positions])
  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, positions.length]} castShadow>
        <cylinderGeometry args={[0.18, 0.26, 2.2, 6]} />
        <meshStandardMaterial color="#5b4636" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, positions.length]} castShadow>
        <icosahedronGeometry args={[1.5, 0]} />
        <meshStandardMaterial roughness={0.95} flatShading />
      </instancedMesh>
    </group>
  )
}

export function Lamps({ districts, lights }: { districts: District[]; lights: boolean }) {
  const spots = useMemo(() => {
    const out: Vec2[] = []
    for (const d of districts.filter((x) => x.status === 'active')) {
      const len = Math.hypot(d.building.door.x, d.building.door.z)
      for (let t = 16; t < len - 2; t += 7) {
        const ux = d.building.door.x / len, uz = d.building.door.z / len
        out.push({ x: ux * t + uz * 2.8, z: uz * t - ux * 2.8 }, { x: ux * t - uz * 2.8, z: uz * t + ux * 2.8 })
      }
    }
    return out
  }, [districts])
  return (
    <group>
      {spots.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position-y={1.6} castShadow>
            <cylinderGeometry args={[0.06, 0.09, 3.2, 8]} />
            <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position-y={3.3}>
            <sphereGeometry args={[0.22, 12, 10]} />
            <meshStandardMaterial color="#e0f2fe" emissive="#7dd3fc" emissiveIntensity={1.6} />
          </mesh>
          {lights && i % 4 === 0 && <pointLight position-y={3.2} distance={9} intensity={4} color="#7dd3fc" />}
        </group>
      ))}
    </group>
  )
}

/** Central monument: the NEXORA knot - a slowly turning hologram over the plaza. */
export function Monument() {
  const knot = useRef<Mesh>(null)
  useFrame((_, dt) => {
    if (knot.current) knot.current.rotation.y += dt * 0.35
  })
  return (
    <group>
      <mesh position-y={0.6} castShadow receiveShadow>
        <cylinderGeometry args={[1.7, 2, 1.2, 32]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.45} />
      </mesh>
      <mesh position-y={1.23}>
        <cylinderGeometry args={[1.45, 1.45, 0.06, 32]} />
        <meshStandardMaterial color="#2dd4bf" emissive="#2dd4bf" emissiveIntensity={1.4} />
      </mesh>
      <mesh ref={knot} position-y={3.6}>
        <torusKnotGeometry args={[1, 0.28, 160, 16, 2, 3]} />
        <meshStandardMaterial color="#2dd4bf" emissive="#14b8a6" emissiveIntensity={1.1} metalness={0.4} roughness={0.25} wireframe />
      </mesh>
      <pointLight position-y={3.6} distance={14} intensity={6} color="#2dd4bf" />
    </group>
  )
}
