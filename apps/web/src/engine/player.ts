/**
 * High-frequency player state lives outside React to avoid re-rendering the UI every frame.
 * The 3D scene writes it; the HUD/minimap sample it on a timer.
 */
import type { PlayerState } from '@nexora/world-engine'

export const player: { state: PlayerState; yaw: number; moving: boolean; nearby: string | null } = {
  state: { x: 0, z: 18, heading: 0 },
  yaw: 0,
  moving: false,
  nearby: null,
}

type Listener = (id: string | null) => void
const listeners = new Set<Listener>()
export function setNearby(id: string | null) {
  if (player.nearby === id) return
  player.nearby = id
  listeners.forEach((l) => l(id))
}
export function onNearby(l: Listener) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

/** Global keyboard input; ignored while the student is typing in a form or editor. */
export const keys = { forward: false, back: false, left: false, right: false, run: false }
const MAP: Record<string, keyof typeof keys> = {
  KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run',
}
export function isTyping(e: Event): boolean {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}
export function bindKeys(): () => void {
  const down = (e: KeyboardEvent) => { if (!isTyping(e) && MAP[e.code]) keys[MAP[e.code]] = true }
  const up = (e: KeyboardEvent) => { if (MAP[e.code]) keys[MAP[e.code]] = false }
  const blur = () => { for (const k of Object.keys(keys) as (keyof typeof keys)[]) keys[k] = false }
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
  }
}
