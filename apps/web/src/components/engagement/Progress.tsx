import { CheckCircle2, Circle, Flame, Share2, TrendingUp } from 'lucide-react'
import { useEffect } from 'react'
import { useApp } from '../../stores/app'
import { Badge, Button, Meter, Panel, Spinner } from '../ui/primitives'

export const RANK_COLOR: Record<string, string> = {
  intern: '#94a3b8', junior: '#38bdf8', engineer: '#2dd4bf', senior: '#a78bfa', principal: '#f472b6', research: '#facc15',
}

export function ProgressPanel() {
  const { progression: p, refreshProgression, open } = useApp()
  useEffect(() => { void refreshProgression() }, [refreshProgression])
  if (!p) return <Panel title="Engineer progression"><div className="p-5"><Spinner /></div></Panel>
  const color = RANK_COLOR[p.rank.id] ?? '#2dd4bf'
  return (
    <Panel title="Engineer progression" subtitle="XP, ranks and streaks come only from verified work" accent={color} wide>
      <div className="grid gap-5 p-5 lg:grid-cols-[1.1fr_1fr]">
        <section className="space-y-4">
          <div className="rounded-xl border p-4" style={{ borderColor: `${color}55`, background: `${color}0f` }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color }}>Rank {p.rank.index + 1} of {p.rank.of}</div>
            <div className="mt-1 text-2xl font-bold text-white">{p.rank.title}</div>
            <div className="mt-3 flex items-center justify-between text-xs text-ink-200"><span>Level {p.level.level}</span><span className="font-mono">{p.xp} XP · next level at {p.level.next_level_at}</span></div>
            <div className="mt-1"><Meter value={p.level.into_level / p.level.level_span} color={color} label="Level progress" /></div>
            <Button tone="ghost" className="mt-3" onClick={() => open({ kind: 'share', card: 'rank' })}><Share2 size={14} /> Share rank card</Button>
          </div>
          {p.rank.next ? (
            <div className="rounded-xl border border-ink-700 p-4">
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white"><TrendingUp size={16} /> Path to {p.rank.next.title}</h3>
              <p className="mb-2 text-[11px] text-ink-400">Ranks need evidence across skills - XP alone is never enough.</p>
              <ul className="space-y-2">
                {p.rank.next.checks.map((c) => (
                  <li key={c.label} className="text-xs">
                    <div className="flex items-center gap-2">
                      {c.met ? <CheckCircle2 size={14} className="text-teal" aria-label="Met" /> : <Circle size={14} className="text-ink-400" aria-label="Not met" />}
                      <span className={c.met ? 'text-ink-400' : 'text-ink-200'}>{c.label}</span>
                      <span className="ml-auto font-mono text-ink-400">{fmt(c.have, c.unit)} / {fmt(c.need, c.unit)}</span>
                    </div>
                    {!c.met && <div className="ml-6 mt-1"><Meter value={c.have / c.need} label={c.label} /></div>}
                  </li>
                ))}
              </ul>
            </div>
          ) : <p className="text-sm text-teal">Highest rank reached.</p>}
        </section>
        <aside className="space-y-4">
          <div className="rounded-xl border border-ink-700 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Flame size={16} className="text-orange-400" /> Learning streak</h3>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <Stat label="Current" value={`${p.streak.current} day${p.streak.current === 1 ? '' : 's'}`} />
              <Stat label="Longest" value={`${p.streak.longest} day${p.streak.longest === 1 ? "" : "s"}`} />
              <Stat label="Active days" value={String(p.streak.total_active_days)} />
            </div>
            <div className="mt-3 grid grid-flow-col grid-rows-7 gap-1" role="img" aria-label={`Activity in the last 12 weeks: ${p.streak.calendar.filter((d) => d.active).length} active days`}>
              {p.streak.calendar.map((d) => (
                <div key={d.date} title={`${d.date}${d.active ? ' · active' : ''}`} className="h-3 w-3 rounded-sm"
                  style={{ background: d.active ? '#2dd4bf' : '#1c242f' }} />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-400">A day counts when you take an assessment, pass a mission or challenge, or save an experiment ({p.timezone}). Breaks are fine - your progress never disappears.</p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-white">XP history</h3>
            <ul className="scroll-thin max-h-64 space-y-1 overflow-y-auto text-xs">
              {p.history.map((h, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg border border-ink-700 px-2.5 py-1.5">
                  <Badge>+{h.xp}</Badge><span className="text-ink-200">{h.reason}</span>
                  <span className="ml-auto text-ink-400">{new Date(h.created_at + 'Z').toLocaleDateString()}</span>
                </li>
              ))}
              {p.history.length === 0 && <li className="text-ink-400">No XP yet - pass an assessment, mission or challenge.</li>}
            </ul>
          </div>
        </aside>
      </div>
    </Panel>
  )
}

const fmt = (v: number, unit: 'count' | 'percent') => (unit === 'percent' ? `${Math.round(v * 100)}%` : String(v))

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-ink-800 px-2 py-1.5"><div className="text-[10px] uppercase text-ink-400">{label}</div><div className="text-sm font-semibold text-white">{value}</div></div>
}
