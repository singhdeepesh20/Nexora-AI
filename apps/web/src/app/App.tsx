import { lazy, Suspense, useEffect, useRef } from 'react'
import { api } from '../services/api'
import { Campus } from '../components/world/Campus'
import { Hud } from '../components/ui/Hud'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'
import { Spinner } from '../components/ui/primitives'
import { bindKeys, player } from '../engine/player'
import { useApp } from '../stores/app'
import { Welcome } from './Welcome'

const Overlays = lazy(() => import('./Overlays'))

export function App() {
  const { ready, bootError, boot, student, world } = useApp()
  useEffect(() => { void boot() }, [boot])
  if (bootError) return <BootError message={bootError} />
  if (!ready || !world) return <Loading label="Starting NEXORA" />
  if (!student) return <Welcome />
  return <CampusShell />
}

function CampusShell() {
  const { student, world, overlays, open, back, closeAll } = useApp()
  const lastSaved = useRef('')

  // restore avatar position once per student
  useEffect(() => {
    const pos = student?.avatar?.position
    if (pos) player.state = { x: pos.x, z: pos.z, heading: pos.heading }
  }, [student?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => bindKeys(), [])

  // Viral-first: a new student breaks (and fixes) a real neural network within seconds of arriving.
  // The campus, gate and admission are the reward that opens up afterwards. Skippable.
  useEffect(() => {
    if (student?.settings.onboarding !== 'pending') return
    const t = setTimeout(() => { if (!useApp.getState().overlays.length) useApp.getState().open({ kind: 'onboarding' }) }, 900)
    return () => clearTimeout(t)
  }, [student?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // persist world state every few seconds when it changed
  useEffect(() => {
    const t = setInterval(() => {
      const s = player.state
      const key = `${s.x.toFixed(1)},${s.z.toFixed(1)}`
      if (student && key !== lastSaved.current) {
        lastSaved.current = key
        void api.put(`/students/${student.id}/avatar`, { x: s.x, z: s.z, heading: s.heading }).catch(() => undefined)
      }
    }, 4000)
    return () => clearInterval(t)
  }, [student])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest?.('input, textarea, select, [contenteditable="true"], .monaco-editor')) {
        if (e.key === 'Escape') (t as HTMLElement).blur?.()
        return
      }
      const state = useApp.getState()
      if (e.key === 'Escape') {
        if (state.overlays.length) back()
        else open({ kind: 'pause' })
        return
      }
      if (state.overlays.length) return
      if (e.code === 'KeyE' && player.nearby && world) {
        const near = player.nearby
        if (near === 'npc:guard') open({ kind: 'guard' })
        else if (near === 'admission') open({ kind: 'admission' })
        else if (near.startsWith('student:')) open({ kind: 'classmate', id: near.slice(8) })
        else if (near.startsWith('npc:')) open({ kind: 'professor', id: near.slice(4) })
        else if (near === 'machine') open(state.student?.settings.onboarding === 'pending' ? { kind: 'onboarding' } : { kind: 'challenges' })
        else {
          const d = world.districts.find((x) => x.id === near)
          if (d) open(d.status === 'active' ? { kind: 'district', id: d.id } : { kind: 'gate', id: d.id })
        }
      } else if (e.code === 'KeyM') open({ kind: 'map' })
      else if (e.code === 'KeyB') open({ kind: 'challenges' })
      else if (e.code === 'KeyP') open({ kind: 'progress' })
      else if (e.code === 'KeyI') open({ kind: 'idcard' })
      else if (e.code === 'KeyO') open({ kind: 'portal' })
      else if (e.code === 'KeyJ') open({ kind: 'dashboard' })
      else if (e.code === 'KeyK') open({ kind: 'missions' })
      else if (e.code === 'KeyL') open({ kind: 'projects' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [world, open, back, closeAll])

  if (!student || !world) return null
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Campus world={world} preset={student.settings.graphics ?? 'medium'}
        body={student.avatar?.body_color ?? '#2dd4bf'} accent={student.avatar?.accent_color ?? '#38bdf8'} />
      <Hud />
      {overlays.length > 0 && (
        <ErrorBoundary onReset={closeAll}>
          <Suspense fallback={<div className="absolute inset-0 z-30 grid place-items-center bg-ink-950/50"><Spinner /></div>}>
            <Overlays />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  )
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center bg-ink-950">
      <div className="flex flex-col items-center gap-5">
        <Logo size={56} />
        <Spinner label={label} />
      </div>
    </div>
  )
}

function BootError({ message }: { message: string }) {
  return (
    <div className="grid h-full place-items-center bg-ink-950 p-6">
      <div className="max-w-md text-center">
        <Logo size={48} />
        <h1 className="mt-4 text-lg font-semibold text-white">Cannot reach the NEXORA backend</h1>
        <p className="mt-2 text-sm text-ink-400">{message}</p>
        <p className="mt-4 text-sm text-ink-400">Start NEXORA with <code className="text-teal">pnpm start</code> (or <code className="text-teal">pnpm dev</code> for development) and reload this page.</p>
      </div>
    </div>
  )
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="14" fill="#11161c" stroke="#2dd4bf33" />
      <path d="M16 46V18l32 28V18" fill="none" stroke="#2dd4bf" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
