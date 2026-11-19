import { Bug, BookOpen, Flame, FolderGit2, Gauge, Map as MapIcon, Settings, Swords, Zap } from 'lucide-react'
import { RANK_COLOR } from '../engagement/Progress'
import { useEffect, useState } from 'react'
import { perf } from '../../engine/graphics'
import { onNearby, player } from '../../engine/player'
import { useApp } from '../../stores/app'
import { Meter } from './primitives'

export function Hud() {
  const { student, learning, world, open, toasts, overlays, progression } = useApp()
  const [near, setNear] = useState<string | null>(null)
  const [fps, setFps] = useState(0)
  const [help, setHelp] = useState(true)
  useEffect(() => onNearby(setNear), [])
  useEffect(() => {
    const t = setInterval(() => setFps(perf.fps), 500)
    return () => clearInterval(t)
  }, [])
  if (!student || !world) return null
  const nearDistrict = world.districts.find((d) => d.id === near)
  const nearOther = near?.startsWith('npc:') ? `Talk to ${near === 'npc:nova' ? 'Professor Nova' : `Professor ${near.slice(4, 5).toUpperCase()}${near.slice(5)}`}`
    : near === 'machine' ? 'Use the Experiment Machine' : null
  const totals = learning?.totals
  const buttons = [
    { icon: MapIcon, label: 'Map', key: 'M', on: () => open({ kind: 'map' }) },
    { icon: Gauge, label: 'Dashboard', key: 'J', on: () => open({ kind: 'dashboard' }) },
    { icon: Swords, label: 'Missions', key: 'K', on: () => open({ kind: 'missions' }) },
    { icon: Zap, label: 'Challenges', key: 'B', on: () => open({ kind: 'challenges' }) },
    { icon: Bug, label: 'Daily', key: '', on: () => open({ kind: 'daily' }) },
    { icon: FolderGit2, label: 'My Lab', key: 'L', on: () => open({ kind: 'projects' }) },
    { icon: Settings, label: 'Settings', key: '', on: () => open({ kind: 'settings' }) },
  ]
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="glass pointer-events-auto flex min-w-0 items-center gap-3 rounded-xl px-3 py-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-bold text-ink-950" style={{ background: student.avatar?.body_color ?? '#2dd4bf' }}>
            {student.display_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{student.display_name}</div>
            <div className="flex items-center gap-2 text-[11px] text-ink-400">
              <span className="whitespace-nowrap">{totals ? `${totals.mastered}/${totals.concepts} concepts mastered` : '…'}</span>
              <div className="w-20"><Meter value={totals ? totals.mastered / totals.concepts : 0} label="Overall mastery" /></div>
            </div>
          </div>
        </div>
        {progression && (
          <button onClick={() => open({ kind: 'progress' })} title="Engineer progression (P)"
            className="glass pointer-events-auto hidden items-center gap-2 rounded-xl px-3 py-2 text-left sm:flex">
            <span className="h-7 w-1.5 rounded-full" style={{ background: RANK_COLOR[progression.rank.id] }} />
            <span>
              <span className="block text-xs font-semibold text-white">{progression.rank.title}</span>
              <span className="block text-[11px] text-ink-400">Lv {progression.level.level} · {progression.xp} XP</span>
            </span>
            <span className="ml-1 flex items-center gap-0.5 text-xs text-orange-300" aria-label={`${progression.streak.current}-day streak`}>
              <Flame size={13} />{progression.streak.current}
            </span>
          </button>
        )}
        <nav className="glass pointer-events-auto flex gap-1 rounded-xl p-1">
          {buttons.map((b) => (
            <button key={b.label} onClick={b.on} title={b.key ? `${b.label} (${b.key})` : b.label}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-ink-200 hover:bg-ink-700 hover:text-white">
              <b.icon size={15} /> <span className="hidden xl:inline">{b.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {toasts.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`glass animate-in rounded-xl px-4 py-2 text-sm ${t.tone === 'success' ? 'text-teal' : t.tone === 'error' ? 'text-red-300' : 'text-ink-200'}`}>
              {t.text}
            </div>
          ))}
        </div>
      )}

      {nearOther && overlays.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-4">
          <div className="glass animate-in flex items-center gap-3 rounded-xl px-4 py-2.5">
            <kbd className="rounded-md border border-ink-600 bg-ink-800 px-2 py-0.5 font-mono text-sm text-white">E</kbd>
            <span className="text-sm text-ink-200">{nearOther}</span>
          </div>
        </div>
      )}

      {nearDistrict && overlays.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-4">
          <div className="glass animate-in flex items-center gap-3 rounded-xl px-4 py-2.5">
            <kbd className="rounded-md border border-ink-600 bg-ink-800 px-2 py-0.5 font-mono text-sm text-white">E</kbd>
            <span className="text-sm text-ink-200">
              {nearDistrict.status === 'active' ? 'Enter' : 'Inspect'} <b className="text-white">{nearDistrict.building.label}</b>
            </span>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 p-3 sm:p-4">
        <div className="glass pointer-events-auto max-w-xs rounded-xl px-3 py-2 text-[11px] text-ink-400">
          <button className="flex w-full items-center gap-1.5 text-left font-medium text-ink-200" onClick={() => setHelp(!help)}>
            <BookOpen size={13} /> Controls {help ? '−' : '+'}
          </button>
          {help && (
            <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <span className="font-mono text-ink-200">W A S D</span><span>Move</span>
              <span className="font-mono text-ink-200">Shift</span><span>Run</span>
              <span className="font-mono text-ink-200">Mouse</span><span>Click to look around · scroll to zoom</span>
              <span className="font-mono text-ink-200">E</span><span>Interact</span>
              <span className="font-mono text-ink-200">M</span><span>Map</span>
              <span className="font-mono text-ink-200">Esc</span><span>Pause / back</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {student.settings.show_fps && (
            <div className="glass rounded-lg px-2 py-1 font-mono text-[11px] text-ink-200" data-testid="fps">{fps} FPS</div>
          )}
          <MiniMap />
        </div>
      </div>
    </>
  )
}

export function MiniMap({ size = 150 }: { size?: number }) {
  const world = useApp((s) => s.world)
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 120)
    return () => clearInterval(t)
  }, [])
  if (!world) return null
  const b = world.world.bounds
  const sx = (x: number) => ((x - b.min_x) / (b.max_x - b.min_x)) * size
  const sz = (z: number) => ((z - b.min_z) / (b.max_z - b.min_z)) * size * ((b.max_z - b.min_z) / (b.max_x - b.min_x))
  const h = sz(b.max_z)
  const p = player.state
  return (
    <svg width={size} height={h} className="glass pointer-events-auto rounded-xl" aria-label="Campus minimap">
      <circle cx={sx(0)} cy={sz(0)} r={(world.world.plaza_radius / (b.max_x - b.min_x)) * size} fill="#2dd4bf22" stroke="#2dd4bf66" />
      {world.districts.map((d) => {
        const bb = d.building
        return <rect key={d.id} x={sx(bb.x - bb.w / 2)} y={sz(bb.z - bb.d / 2)} width={(bb.w / (b.max_x - b.min_x)) * size}
          height={(bb.d / (b.max_x - b.min_x)) * size} rx={2} fill={d.status === 'active' ? d.color : '#475569'} opacity={d.status === 'active' ? 0.9 : 0.6} />
      })}
      <g transform={`translate(${sx(p.x)} ${sz(p.z)}) rotate(${(-p.heading * 180) / Math.PI + 180})`}>
        <path d="M0 -6 L4 4 L0 2 L-4 4 Z" fill="white" stroke="#0d1117" strokeWidth={1} />
      </g>
    </svg>
  )
}

