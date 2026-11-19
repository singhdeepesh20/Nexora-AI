import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, DoubleSide, SRGBColorSpace, type Group } from 'three'
import type { Box } from '@nexora/world-engine'
import { Human, type Look } from './Human'

export const GATE_Z = 56
export const GUARD = { x: 5.2, z: 59.6 }
export const ADMISSION = { x: -17, z: 68, w: 12, d: 8, h: 6, door: { x: -10.6, z: 68 } }
const BOOTH = { x: 9.2, z: 59.5 }
const BUS = { x: -6.8, z: 78 }
const CARS = [[19, 66, '#e2e8f0'], [22.5, 66, '#1e3a8a'], [26, 66, '#991b1b'], [29.5, 66, '#111827'], [19, 76, '#a3a3a3'], [22.5, 76, '#14532d'], [29.5, 76, '#f59e0b']] as const

const box = (x: number, z: number, w: number, d: number): Box => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 })

/** Static colliders of the entrance zone. The barrier collider is added only while the gate is closed. */
export const ENTRANCE_COLLIDERS: Box[] = [
  box(-37.5, GATE_Z, 61, 0.8), box(37.5, GATE_Z, 61, 0.8), // perimeter wall with a 14 m gap
  box(-7.5, GATE_Z, 2.2, 2.2), box(7.5, GATE_Z, 2.2, 2.2), // gate pillars
  box(BOOTH.x, BOOTH.z, 3, 3), box(GUARD.x, GUARD.z, 0.7, 0.7),
  box(ADMISSION.x, ADMISSION.z, ADMISSION.w, ADMISSION.d), box(BUS.x, BUS.z, 2.7, 10.5),
  ...CARS.map(([x, z]) => box(x, z, 2, 4.4)),
]
export const BARRIER_COLLIDER: Box = box(0, GATE_Z, 13, 0.6)
export const ENTRANCE_AVOID: Box[] = [box(24, 71, 18, 16), box(0, 78, 10, 46), box(-17, 68, 16, 12)]

const GUARD_LOOK: Look = {
  skin: '#c68863', hair: '#1c1410', hairStyle: 'short', top: '#1e3a5f', bottom: '#0f172a', shoes: '#111827', height: 1.02, build: 1.05,
  glasses: false, backpack: null, outer: 'uniform', outerColor: '#1e3a5f', cap: '#0f172a',
}

/** Text drawn to a canvas texture: offline, no font downloads, disposed on unmount. */
export function useTextTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    draw(c.getContext('2d')!, w, h)
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 4
    return t
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

const SERIF = 'Georgia, "Times New Roman", serif'

function GateSign({ z, flip }: { z: number; flip?: boolean }) {
  const tex = useTextTexture((ctx, w, h) => {
    ctx.fillStyle = '#ece8df'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#14532d'
    ctx.lineWidth = 8
    ctx.strokeRect(16, 16, w - 32, h - 32)
    ctx.fillStyle = '#14532d'
    ctx.textAlign = 'center'
    ctx.font = `700 92px ${SERIF}`
    ctx.fillText('NEXORA UNIVERSITY', w / 2, 128)
    ctx.font = `600 34px ${SERIF}`
    ctx.fillStyle = '#3f3f46'
    ctx.fillText('LEARN · EXPERIMENT · INNOVATE', w / 2, 186)
  }, 1280, 230)
  return (
    <mesh position={[0, 7.1, z]} rotation-y={flip ? Math.PI : 0}>
      <planeGeometry args={[13.6, 2.45]} />
      <meshStandardMaterial map={tex} roughness={0.8} />
    </mesh>
  )
}

function Barrier({ open, reduce }: { open: boolean; reduce: boolean }) {
  const arm = useRef<Group>(null)
  useFrame((_, dt) => {
    if (!arm.current) return
    const target = open ? Math.PI * 0.47 : 0
    const cur = arm.current.rotation.z
    arm.current.rotation.z = reduce ? target : cur + (target - cur) * Math.min(1, dt * 3)
  })
  return (
    <group position={[6.3, 1.05, GATE_Z]}>
      <mesh position-y={-0.5}><boxGeometry args={[0.6, 1.1, 0.6]} /><meshStandardMaterial color="#e5e7eb" roughness={0.6} /></mesh>
      <group ref={arm}>
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} position={[-0.55 - i, 0, 0]} castShadow>
            <boxGeometry args={[1, 0.14, 0.1]} />
            <meshStandardMaterial color={i % 2 ? '#f8fafc' : '#b91c1c'} roughness={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function Flag({ x, z, color, reduce }: { x: number; z: number; color: string; reduce: boolean }) {
  const cloth = useRef<Group>(null)
  const tex = useTextTexture((ctx, w, h) => {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#f5f5f4'
    ctx.font = `700 64px ${SERIF}`
    ctx.textAlign = 'center'
    ctx.fillText('N', w / 2, h / 2 + 22)
    ctx.strokeStyle = '#f5f5f4'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 52, 0, Math.PI * 2)
    ctx.stroke()
  }, 256, 170)
  useFrame(({ clock }) => {
    if (cloth.current && !reduce) cloth.current.rotation.y = Math.sin(clock.elapsedTime * 1.3 + x) * 0.18
  })
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={4}><cylinderGeometry args={[0.05, 0.07, 8, 8]} /><meshStandardMaterial color="#d4d4d8" metalness={0.7} roughness={0.3} /></mesh>
      <group ref={cloth} position-y={7.2}>
        <mesh position-x={0.85}><planeGeometry args={[1.7, 1.1]} /><meshStandardMaterial map={tex} side={DoubleSide} roughness={0.9} /></mesh>
      </group>
    </group>
  )
}

function Car({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.55} castShadow><boxGeometry args={[1.8, 0.7, 4.2]} /><meshStandardMaterial color={color} metalness={0.5} roughness={0.35} /></mesh>
      <mesh position={[0, 1.1, -0.2]} castShadow><boxGeometry args={[1.6, 0.55, 2.2]} /><meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.15} /></mesh>
      {[[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.4], [0.85, -1.4]].map(([wx, wz], i) => (
        <mesh key={i} position={[wx, 0.32, wz]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.32, 0.32, 0.22, 14]} /><meshStandardMaterial color="#111" /></mesh>
      ))}
    </group>
  )
}

function Shuttle() {
  const tex = useTextTexture((ctx, w, h) => {
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#166534'
    ctx.fillRect(0, h * 0.62, w, h * 0.16)
    ctx.font = `700 54px ${SERIF}`
    ctx.fillText('NEXORA UNIVERSITY · CAMPUS SHUTTLE', 40, 90)
  }, 1200, 240)
  return (
    <group position={[BUS.x, 0, BUS.z]}>
      <mesh position-y={1.75} castShadow>
        <boxGeometry args={[2.5, 2.8, 10]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.5} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 1.26, 1.9, 0]} rotation-y={s * Math.PI / 2}><planeGeometry args={[10, 2]} /><meshStandardMaterial map={tex} /></mesh>
      ))}
      <mesh position={[0, 2.25, -5.01]}><planeGeometry args={[2.2, 1.2]} /><meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.1} /></mesh>
      {[[-1.2, 3.4], [1.2, 3.4], [-1.2, -3.4], [1.2, -3.4]].map(([wx, wz], i) => (
        <mesh key={i} position={[wx, 0.45, wz]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.45, 0.45, 0.3, 16]} /><meshStandardMaterial color="#111" /></mesh>
      ))}
    </group>
  )
}

function AdmissionCentre({ highlighted }: { highlighted: boolean }) {
  const a = ADMISSION
  const tex = useTextTexture((ctx, w, h) => {
    ctx.fillStyle = '#14532d'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#f5f5f4'
    ctx.textAlign = 'center'
    ctx.font = `700 50px ${SERIF}`
    ctx.fillText('ADMISSION & VISITOR CENTRE', w / 2, 82)
  }, 1024, 128)
  return (
    <group position={[a.x, 0, a.z]}>
      <mesh position-y={a.h / 2} castShadow receiveShadow><boxGeometry args={[a.w, a.h, a.d]} /><meshStandardMaterial color="#ece8df" roughness={0.85} /></mesh>
      {[-3, 0, 3].map((zz) => (
        <mesh key={zz} position={[a.w / 2 + 0.01, 3.4, zz]} rotation-y={Math.PI / 2}><planeGeometry args={[1.6, 2]} /><meshStandardMaterial color="#334155" metalness={0.5} roughness={0.15} /></mesh>
      ))}
      <mesh position={[a.w / 2 + 0.02, 1.2, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.8, 2.4]} />
        <meshStandardMaterial color="#1e293b" emissive={highlighted ? '#166534' : '#000000'} emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[a.w / 2 + 0.03, 5.1, 0]} rotation-y={Math.PI / 2}><planeGeometry args={[8, 1]} /><meshStandardMaterial map={tex} /></mesh>
      <mesh position-y={a.h + 0.15}><boxGeometry args={[a.w + 0.8, 0.3, a.d + 0.8]} /><meshStandardMaterial color="#d6d3cb" /></mesh>
    </group>
  )
}

function Directory() {
  const tex = useTextTexture((ctx, w, h) => {
    ctx.fillStyle = '#1c2a22'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#f5f5f4'
    ctx.font = `700 46px ${SERIF}`
    ctx.fillText('CAMPUS DIRECTORY', 36, 70)
    ctx.font = '400 30px ui-sans-serif, system-ui, sans-serif'
    const rows = ['↑  Central Plaza · Experiment Machine', '↖  Foundation Hall (Mathematics & CS)', '↑  Learning Systems Institute (ML)',
      '↗  Neural Center (Deep Learning)', '←  Admission & Visitor Centre', '→  Visitor Parking', 'Opening soon: Generative AI, Engineering', 'Studio, Infrastructure, Robotics, Innovation']
    rows.forEach((r, i) => ctx.fillText(r, 36, 140 + i * 50))
  }, 760, 560)
  return (
    <group position={[-4.8, 0, 51.5]} rotation-y={0}>
      {[-1.1, 1.1].map((x) => <mesh key={x} position={[x, 1.2, 0]}><boxGeometry args={[0.12, 2.4, 0.12]} /><meshStandardMaterial color="#3f3f46" /></mesh>)}
      <mesh position-y={2.1}><boxGeometry args={[2.5, 1.85, 0.08]} /><meshStandardMaterial color="#1c2a22" /></mesh>
      <mesh position={[0, 2.1, 0.05]}><planeGeometry args={[2.4, 1.77]} /><meshStandardMaterial map={tex} /></mesh>
    </group>
  )
}

function Gardens() {
  const beds = useMemo(() => {
    const out: [number, number, string][] = []
    const colors = ['#f472b6', '#facc15', '#f97316', '#e11d48', '#a78bfa', '#fef3c7']
    for (let z = 62; z < 98; z += 3.2) for (const s of [-1, 1]) out.push([s * 5.4, z, colors[(Math.round(z) + (s > 0 ? 2 : 0)) % colors.length]])
    return out
  }, [])
  return (
    <group>
      {beds.map(([x, z, c], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position-y={0.3}><boxGeometry args={[1.1, 0.6, 2.4]} /><meshStandardMaterial color="#2f5d2a" roughness={1} /></mesh>
          {[-0.7, 0, 0.7].map((dz) => <mesh key={dz} position={[0, 0.66, dz]}><sphereGeometry args={[0.18, 8, 6]} /><meshStandardMaterial color={c} roughness={0.8} /></mesh>)}
        </group>
      ))}
    </group>
  )
}

export function Entrance({ gateOpen, near, reduce }: { gateOpen: boolean; near: string | null; reduce: boolean }) {
  return (
    <group>
      {/* entrance road and parking */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 78]} receiveShadow><planeGeometry args={[8, 44]} /><meshStandardMaterial color="#3f3f46" roughness={0.95} /></mesh>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[0, 0.02, 60 + i * 4]}><planeGeometry args={[0.18, 2]} /><meshStandardMaterial color="#f5f5f4" /></mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[24, 0.012, 71]} receiveShadow><planeGeometry args={[18, 16]} /><meshStandardMaterial color="#44403c" roughness={0.95} /></mesh>
      {CARS.map(([x, z, c], i) => <Car key={i} x={x} z={z} color={c} />)}
      <Shuttle />
      <Gardens />
      {/* perimeter wall with railings */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 37.5, 0.6, GATE_Z]} castShadow receiveShadow><boxGeometry args={[61, 1.2, 0.8]} /><meshStandardMaterial color="#d6d3cb" roughness={0.9} /></mesh>
          <mesh position={[s * 37.5, 1.55, GATE_Z]}><boxGeometry args={[61, 0.08, 0.08]} /><meshStandardMaterial color="#27272a" metalness={0.6} /></mesh>
          {Array.from({ length: 16 }, (_, i) => (
            <mesh key={i} position={[s * (8 + i * 4), 1.4, GATE_Z]}><boxGeometry args={[0.5, 1.6, 0.9]} /><meshStandardMaterial color="#ece8df" /></mesh>
          ))}
        </group>
      ))}
      {/* monumental gate */}
      {[-7.5, 7.5].map((x) => (
        <group key={x} position={[x, 0, GATE_Z]}>
          <mesh position-y={3.6} castShadow><boxGeometry args={[2, 7.2, 2]} /><meshStandardMaterial color="#ece8df" roughness={0.85} /></mesh>
          <mesh position-y={7.35}><boxGeometry args={[2.4, 0.3, 2.4]} /><meshStandardMaterial color="#d6d3cb" /></mesh>
          <mesh position-y={2.2}><boxGeometry args={[2.05, 0.25, 2.05]} /><meshStandardMaterial color="#166534" /></mesh>
        </group>
      ))}
      <mesh position={[0, 7.1, GATE_Z]} castShadow><boxGeometry args={[17, 2.6, 1]} /><meshStandardMaterial color="#e7e5e4" roughness={0.85} /></mesh>
      <GateSign z={GATE_Z + 0.51} />
      <GateSign z={GATE_Z - 0.51} flip />
      <Barrier open={gateOpen} reduce={reduce} />
      {/* ID scanner on the pedestrian lane */}
      <group position={[3.4, 0, GATE_Z + 1.6]}>
        <mesh position-y={0.6}><boxGeometry args={[0.35, 1.2, 0.3]} /><meshStandardMaterial color="#27272a" /></mesh>
        <mesh position={[0, 1.15, 0.16]} rotation-x={-0.4}><planeGeometry args={[0.28, 0.2]} /><meshStandardMaterial color={gateOpen ? '#16a34a' : '#0ea5e9'} emissive={gateOpen ? '#16a34a' : '#0ea5e9'} emissiveIntensity={1.2} /></mesh>
      </group>
      {/* security booth and guard */}
      <group position={[BOOTH.x, 0, BOOTH.z]}>
        <mesh position-y={1.4} castShadow><boxGeometry args={[3, 2.8, 3]} /><meshStandardMaterial color="#f5f5f4" roughness={0.6} /></mesh>
        <mesh position={[-1.51, 1.7, 0]} rotation-y={-Math.PI / 2}><planeGeometry args={[2.2, 1.1]} /><meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.1} /></mesh>
        <mesh position-y={2.95}><boxGeometry args={[3.6, 0.25, 3.6]} /><meshStandardMaterial color="#1e3a5f" /></mesh>
        <Html position={[0, 3.6, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
          <div className="pointer-events-none select-none whitespace-nowrap rounded bg-[#1e3a5f] px-2 py-0.5 text-[11px] font-semibold text-white">SECURITY</div>
        </Html>
      </group>
      <group position={[GUARD.x, 0, GUARD.z]} rotation-y={0.25}>
        <Human look={GUARD_LOOK} />
        <Html position={[0, 2.25, 0]} center distanceFactor={11} zIndexRange={[10, 0]}>
          <div className="pointer-events-none select-none whitespace-nowrap rounded-md px-2 py-0.5 text-[11px]"
            style={{ background: 'rgba(13,17,23,.8)', border: `1px solid ${near === 'npc:guard' ? '#22c55e' : '#1e3a5f'}` }}>
            <b className="text-white">Officer Rahman</b> <span className="text-sky-300">· Campus Security</span>
          </div>
        </Html>
      </group>
      <AdmissionCentre highlighted={near === 'admission'} />
      <Directory />
      {[-11, -13.5, 11, 13.5].map((x, i) => <Flag key={x} x={x} z={GATE_Z + 2.5} color={['#166534', '#1e3a8a', '#1e3a8a', '#166534'][i]} reduce={reduce} />)}
    </group>
  )
}
