import { Award, Download, FlaskConical, HardDrive, LogOut, Map as MapIcon, Play, Sparkles, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Achievement, AIStatus, Experiment } from '@nexora/shared-types'
import { useAsync } from '../../hooks/useAsync'
import { api } from '../../services/api'
import { player } from '../../engine/player'
import { useApp } from '../../stores/app'
import { MiniMap } from '../ui/Hud'
import { Badge, Button, ErrorNote, Meter, Panel, STATUS_COLOR, STATUS_LABEL, Spinner, inputCls } from '../ui/primitives'

export function Dashboard() {
  const { student, learning, concepts, world, open } = useApp()
  const sid = student!.id
  const ach = useAsync(() => api.get<Achievement[]>(`/students/${sid}/achievements`), [sid])
  const exps = useAsync(() => api.get<Experiment[]>(`/students/${sid}/experiments`), [sid])
  if (!learning || !world) return <Panel title="Dashboard"><div className="p-5"><Spinner /></div></Panel>
  return (
    <Panel title="Student Dashboard" subtitle={`${student!.display_name} · ${learning.totals.mastered} of ${learning.totals.concepts} concepts mastered`} wide>
      <div className="grid gap-5 p-5 lg:grid-cols-[1.2fr_1fr]">
        <section className="space-y-5">
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><Sparkles size={16} /> Recommended next steps</h3>
            <p className="mb-2 text-[11px] text-ink-400">Deterministic rules from your prerequisite graph and attempt history - no AI involved.</p>
            <ul className="space-y-2">
              {learning.recommendations.map((r) => (
                <li key={r.concept_id + r.kind}>
                  <button onClick={() => open(r.kind === 'mission' && r.mission_id ? { kind: 'mission', missionId: r.mission_id } : { kind: 'lesson', conceptId: r.concept_id })}
                    className="w-full rounded-xl border border-ink-700 bg-ink-800/50 p-3 text-left hover:border-teal">
                    <span className="flex items-center gap-2"><Badge color={r.kind === 'review' ? '#fb923c' : r.kind === 'mission' ? '#f472b6' : '#38bdf8'}>{r.kind}</Badge><span className="font-medium text-white">{r.title}</span></span>
                    <span className="mt-1 block text-xs text-ink-400">{r.reason}</span>
                  </button>
                </li>
              ))}
              {learning.recommendations.length === 0 && <li className="text-sm text-ink-400">Everything available is mastered. New districts are coming.</li>}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-white">Skill tree</h3>
            <div className="space-y-3">
              {world.districts.filter((d) => d.status === 'active').map((d) => (
                <div key={d.id} className="rounded-xl border border-ink-700 p-3">
                  <div className="mb-2 text-xs font-semibold" style={{ color: d.color }}>{d.title}</div>
                  <div className="flex flex-wrap gap-2">
                    {d.concepts.map((cid) => {
                      const s = learning.concepts[cid]
                      return (
                        <button key={cid} onClick={() => open({ kind: 'lesson', conceptId: cid })} title={`${STATUS_LABEL[s.status]} · mastery ${(s.mastery * 100).toFixed(0)}%`}
                          className="rounded-lg border px-2.5 py-1.5 text-xs" style={{ borderColor: `${STATUS_COLOR[s.status]}66`, color: STATUS_COLOR[s.status], background: `${STATUS_COLOR[s.status]}11` }}>
                          {concepts[cid]?.title}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <aside className="space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-white">Competencies</h3>
            <ul className="space-y-2.5">
              {learning.skills.map((s) => (
                <li key={s.skill_id}>
                  <div className="mb-1 flex justify-between text-xs"><span className="text-ink-200">{s.name}</span><span className="font-mono text-ink-400">{(s.level * 100).toFixed(0)}%</span></div>
                  <Meter value={s.level} label={s.name} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><Award size={16} /> Achievements</h3>
            <div className="flex flex-wrap gap-1.5">{ach.data?.map((a) => <Badge key={a.code} color="#facc15">{a.title.split(' - ')[0]}</Badge>)}</div>
          </div>
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><FlaskConical size={16} /> Experiment history</h3>
            <ul className="space-y-1.5 text-xs">
              {exps.data?.slice(0, 12).map((e) => (
                <li key={e.id} className="flex items-center gap-2 rounded-lg border border-ink-700 px-2.5 py-1.5">
                  <span className="text-ink-200">{e.simulation.replaceAll('_', ' ')}</span>
                  {'status' in e.summary && <Badge color={e.summary.status === 'diverged' ? '#f87171' : '#2dd4bf'}>{String(e.summary.status)}</Badge>}
                  <span className="ml-auto text-ink-400">{new Date(e.created_at + 'Z').toLocaleString()}</span>
                </li>
              ))}
              {exps.data?.length === 0 && <li className="text-ink-400">No experiments yet - visit a laboratory.</li>}
            </ul>
          </div>
        </aside>
      </div>
    </Panel>
  )
}

export function MapPanel() {
  const { world, open, learning } = useApp()
  if (!world) return null
  return (
    <Panel title="Campus Map" subtitle="Eight districts - three open now" accent="#38bdf8">
      <div className="grid gap-5 p-5 md:grid-cols-[auto_1fr]">
        <MiniMap size={300} />
        <ul className="space-y-2">
          {world.districts.map((d) => {
            const mastered = d.concepts.filter((c) => learning?.concepts[c]?.status === 'mastered').length
            const dist = Math.hypot(d.building.door.x - player.state.x, d.building.door.z - player.state.z)
            return (
              <li key={d.id}>
                <button onClick={() => open(d.status === 'active' ? { kind: 'district', id: d.id } : { kind: 'gate', id: d.id })}
                  className="flex w-full items-center gap-3 rounded-xl border border-ink-700 bg-ink-800/50 p-2.5 text-left hover:border-ink-400">
                  <span className="h-8 w-1.5 rounded-full" style={{ background: d.color }} />
                  <span className="flex-1"><span className="block text-sm font-medium text-white">0{d.number} · {d.title}</span>
                    <span className="text-[11px] text-ink-400">{d.status === 'active' ? `${mastered}/${d.concepts.length} mastered` : 'opening soon'} · {dist.toFixed(0)} m away</span></span>
                  <MapIcon size={15} className="text-ink-400" />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </Panel>
  )
}

export function PausePanel() {
  const { closeAll, open, leaveCampus } = useApp()
  return (
    <Panel title="Paused">
      <div className="grid gap-2 p-5 sm:grid-cols-2">
        <Button onClick={closeAll}><Play size={15} /> Resume</Button>
        <Button tone="ghost" onClick={() => open({ kind: 'settings' })}>Settings & data</Button>
        <Button tone="ghost" onClick={() => open({ kind: 'dashboard' })}>Dashboard</Button>
        <Button tone="subtle" onClick={leaveCampus}><LogOut size={15} /> Switch profile</Button>
      </div>
    </Panel>
  )
}

export function SettingsPanel() {
  const { student, updateSettings, system, toast, leaveCampus } = useApp()
  const ai = useAsync(() => api.get<AIStatus>('/ai/status'), [])
  const file = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const s = student!.settings

  const download = async (all: boolean) => {
    setBusy('export')
    setError(null)
    try {
      const blob = await api.download(`/data/export${all ? '' : `?student_id=${student!.id}`}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nexora-backup-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.zip`
      a.click()
      URL.revokeObjectURL(url)
      toast('Backup downloaded. Keep it somewhere safe.', 'success')
    } catch (e) { setError(e) } finally { setBusy(null) }
  }
  const restore = async (f: File) => {
    setBusy('import')
    setError(null)
    try {
      const r = await api.upload<{ students: string[]; project_files: number }>('/data/import', f)
      toast(`Restored ${r.students.length} profile(s) and ${r.project_files} project file(s).`, 'success')
      leaveCampus()
    } catch (e) { setError(e) } finally { setBusy(null) }
  }
  const wipe = async () => {
    setBusy('delete')
    try { await api.post('/data/delete-all', { confirm: confirmText }); window.location.reload() } catch (e) { setError(e); setBusy(null) }
  }
  return (
    <Panel title="Settings" subtitle="Graphics, local AI and your data">
      <div className="space-y-6 p-5">
        <ErrorNote error={error} />
        <section>
          <h3 className="mb-2 text-sm font-semibold text-white">Graphics</h3>
          <div className="flex gap-2" role="radiogroup" aria-label="Graphics quality">
            {(['low', 'medium', 'high'] as const).map((g) => (
              <Button key={g} role="radio" aria-checked={(s.graphics ?? 'medium') === g} tone={(s.graphics ?? 'medium') === g ? 'primary' : 'ghost'} onClick={() => void updateSettings({ graphics: g })} className="capitalize">{g}</Button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-ink-400">Low disables shadows and reduces resolution and scenery for integrated graphics.</p>
          <label className="mt-3 flex items-center gap-2 text-sm text-ink-200"><input type="checkbox" className="accent-teal-400" checked={!!s.show_fps} onChange={(e) => void updateSettings({ show_fps: e.target.checked })} /> Show frame rate</label>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-white">Local AI mentor (optional)</h3>
          {ai.loading ? <Spinner label="Checking for Ollama" /> : ai.data?.available ? (
            <div className="space-y-2">
              <p className="text-xs text-teal">Ollama detected at {ai.data.url} - {ai.data.models.length} model(s) installed.</p>
              <select className={inputCls} value={s.mentor_model ?? ''} onChange={(e) => void updateSettings({ mentor_model: e.target.value })} aria-label="Mentor model">
                <option value="">Offline curriculum mode (no model)</option>
                {ai.data.models.map((m) => <option key={m.name} value={m.name}>{m.name}{m.parameter_size ? ` · ${m.parameter_size}` : ''}{m.quantization ? ` · ${m.quantization}` : ''}</option>)}
              </select>
            </div>
          ) : (
            <p className="text-xs text-ink-400">No local model server found. NEXORA works fully without one. {ai.data?.help}</p>
          )}
          <Button tone="ghost" className="mt-2" onClick={ai.reload}>Re-check</Button>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><HardDrive size={16} /> Your data</h3>
          <p className="text-xs text-ink-400">Everything is stored locally{system ? <> in <code className="text-ink-200">{system.data_dir}</code></> : ''}. {system?.telemetry}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button tone="ghost" onClick={() => void download(false)} disabled={!!busy}><Download size={15} /> Export my profile</Button>
            <Button tone="ghost" onClick={() => void download(true)} disabled={!!busy}><Download size={15} /> Export all profiles</Button>
            <Button tone="ghost" onClick={() => file.current?.click()} disabled={!!busy}><Upload size={15} /> {busy === 'import' ? 'Restoring…' : 'Restore from backup'}</Button>
            <input ref={file} type="file" accept=".zip,application/zip" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = '' }} />
          </div>
          <p className="mt-2 text-[11px] text-ink-400">Backups are verified with SHA-256 checksums and a schema version before anything is restored. Restoring replaces the data of the profiles inside the backup; a safety copy of your current database is kept first.</p>
        </section>

        <section className="rounded-xl border border-red-500/30 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-red-300"><Trash2 size={16} /> Delete all local data</h3>
          <p className="mt-1 text-xs text-ink-400">Permanently removes every profile, progress record, project, conversation and safety copy from this computer. Export a backup first if you might want it back. Type <b className="text-ink-200">DELETE ALL MY DATA</b> to confirm.</p>
          <div className="mt-2 flex gap-2">
            <input className={inputCls} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label="Deletion confirmation" />
            <Button tone="danger" disabled={confirmText !== 'DELETE ALL MY DATA' || !!busy} onClick={() => void wipe()}>Delete</Button>
          </div>
        </section>
        {system && <p className="text-[11px] text-ink-400">NEXORA v{system.version} · curriculum {system.curriculum_version} · schema {system.schema_revision} · code sandbox: {system.sandbox.os_sandbox} ({system.sandbox.strength})</p>}
      </div>
    </Panel>
  )
}
