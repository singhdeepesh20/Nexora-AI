import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Vector3, type Group } from 'three'
import {
  type Box, type Interactable, buildLayout, nearestInteractable, scatterTrees, stepPlayer, treeCollider,
} from '@nexora/world-engine'
import type { WorldResponse } from '@nexora/shared-types'
import { GRAPHICS, type GraphicsPreset, sampleFrame } from '../../engine/graphics'
import { keys, onNearby, player, setNearby } from '../../engine/player'
import { shake } from '../../engine/simEvents'
import { useApp } from '../../stores/app'
import { ExperimentMachine, MACHINE, NPCS, Professor } from './Characters'
import { Avatar } from '../avatar/Avatar'
import { Building, Gate } from '../buildings/Building'
import { Ground, Lamps, Lighting, Monument, Trees } from './Environment'

const MONUMENT: Box = { minX: -2, maxX: 2, minZ: -2, maxZ: 2 }
export const camera = { yaw: 0, pitch: 0.42, distance: 8 }

function PlayerRig({ layout, body, accent, highlightedRef }: {
  layout: ReturnType<typeof buildLayout>; body: string; accent: string; highlightedRef: React.MutableRefObject<string | null>
}) {
  const avatar = useRef<Group>(null)
  const { camera: cam } = useThree()
  const target = useMemo(() => new Vector3(), [])
  const desired = useMemo(() => new Vector3(), [])
  useFrame((_, dt) => {
    sampleFrame(dt)
    const paused = useApp.getState().overlays.length > 0
    const res = paused ? { state: player.state, moving: false } : stepPlayer(player.state, keys, camera.yaw, dt, layout)
    player.state = res.state
    player.moving = res.moving
    const near = nearestInteractable(player.state, layout)
    setNearby(near?.id ?? null)
    highlightedRef.current = near?.id ?? null
    if (avatar.current) {
      avatar.current.position.set(player.state.x, 0, player.state.z)
      const cur = avatar.current.rotation.y
      let diff = player.state.heading - cur
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      avatar.current.rotation.y = cur + diff * Math.min(1, dt * 12)
    }
    const { yaw, pitch, distance } = camera
    target.set(player.state.x, 1.5, player.state.z)
    desired.set(
      player.state.x + Math.sin(yaw) * distance * Math.cos(pitch),
      1.5 + distance * Math.sin(pitch),
      player.state.z + Math.cos(yaw) * distance * Math.cos(pitch),
    )
    cam.position.lerp(desired, Math.min(1, dt * 10))
    cam.lookAt(target)
  })
  return <Avatar ref={avatar} body={body} accent={accent} />
}

function Scene({ world, preset, body, accent }: { world: WorldResponse; preset: GraphicsPreset; body: string; accent: string }) {
  const g = GRAPHICS[preset]
  const highlighted = useRef<string | null>(null)
  const [near, setNear] = useState<string | null>(null)
  useEffect(() => onNearby(setNear), [])
  const { layout, trees } = useMemo(() => {
    const base = buildLayout(world.world.bounds, world.districts, [MONUMENT])
    const trees = scatterTrees(g.trees, world.world.bounds, base.colliders, world.world.plaza_radius)
    return { layout: buildLayout(world.world.bounds, world.districts, [MONUMENT, ...trees.map(treeCollider)]), trees }
  }, [world, g.trees])
  return (
    <>
      <Lighting g={g} />
      <Ground plazaRadius={world.world.plaza_radius} districts={world.districts} />
      <Monument />
      <Trees positions={trees} />
      <Lamps districts={world.districts} lights={g.lampLights} />
      {world.districts.map((d) => d.status === 'active'
        ? <Building key={d.id} district={d} highlighted={near === d.id} />
        : <Gate key={d.id} district={d} highlighted={near === d.id} />)}
      <PlayerRig layout={layout} body={body} accent={accent} highlightedRef={highlighted} />
    </>
  )
}

/** Mouse look: pointer lock on click (fallback: drag). Scroll to zoom. */
function useCameraInput(el: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const node = el.current
    if (!node) return
    let dragging = false
    const look = (dx: number, dy: number) => {
      camera.yaw -= dx * 0.0035
      camera.pitch = Math.max(0.08, Math.min(1.15, camera.pitch + dy * 0.0025))
    }
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement === node || dragging) look(e.movementX, e.movementY)
    }
    const onDown = (e: MouseEvent) => {
      if (useApp.getState().overlays.length) return
      dragging = true
      if (e.button === 0 && document.pointerLockElement !== node) {
        node.requestPointerLock?.()?.catch?.(() => undefined)
      }
    }
    const onUp = () => { dragging = false }
    const onWheel = (e: WheelEvent) => {
      if (useApp.getState().overlays.length) return
      camera.distance = Math.max(4, Math.min(16, camera.distance + e.deltaY * 0.01))
    }
    node.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('mousemove', onMove)
    node.addEventListener('wheel', onWheel, { passive: true })
    const unsub = useApp.subscribe((s, prev) => {
      if (s.overlays.length && !prev.overlays.length && document.pointerLockElement) document.exitPointerLock()
    })
    return () => {
      node.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('mousemove', onMove)
      node.removeEventListener('wheel', onWheel)
      unsub()
    }
  }, [el])
}

export function Campus({ world, preset, body, accent }: { world: WorldResponse; preset: GraphicsPreset; body: string; accent: string }) {
  const g = GRAPHICS[preset]
  const wrap = useRef<HTMLDivElement>(null)
  useCameraInput(wrap)
  return (
    <div ref={wrap} className="absolute inset-0" data-testid="campus">
      {/* key: antialias can only change by recreating the WebGL context; R3F disposes the old scene's GPU resources */}
      <Canvas key={preset} shadows={g.shadows} dpr={g.dpr} gl={{ antialias: g.antialias, powerPreference: 'high-performance' }}
        camera={{ fov: 55, near: 0.1, far: 400, position: [0, 6, 26] }}>
        <Scene world={world} preset={preset} body={body} accent={accent} />
      </Canvas>
    </div>
  )
}
