import { FilePlus, FolderPlus, Play, Save, Trash2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import type { Project, RunResult } from '@nexora/shared-types'
import { useAsync } from '../../hooks/useAsync'
import { api } from '../../services/api'
import { useApp } from '../../stores/app'
import { Button, ErrorNote, Panel, Spinner, inputCls } from '../ui/primitives'

const CodeEditor = lazy(() => import('./CodeEditor'))

/** Personal AI laboratory: local project folders with a sandboxed Python runner. */
export function ProjectsPanel() {
  const { student } = useApp()
  const sid = student!.id
  const projects = useAsync(() => api.get<Project[]>(`/students/${sid}/projects`), [sid])
  const [active, setActive] = useState<string | null>(null)
  const [file, setFile] = useState<string>('main.py')
  const [content, setContent] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [run, setRun] = useState<RunResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [newName, setNewName] = useState('')
  const project = projects.data?.find((p) => p.id === active) ?? null

  useEffect(() => {
    if (!active && projects.data?.length) setActive(projects.data[0].id)
  }, [projects.data, active])
  useEffect(() => {
    if (!active) return
    setContent(null)
    api.get<{ content: string }>(`/students/${sid}/projects/${active}/files/${file}`)
      .then((r) => { setContent(r.content); setDirty(false) }).catch(() => setContent(''))
  }, [active, file, sid])

  const act = async (fn: () => Promise<unknown>) => {
    setError(null)
    try { await fn() } catch (e) { setError(e) }
  }
  const save = () => act(async () => { await api.put(`/students/${sid}/projects/${active}/files/${file}`, { content }); setDirty(false); projects.reload() })
  const exec = () => act(async () => {
    setBusy(true)
    try { if (dirty) await save(); setRun(await api.post<RunResult>(`/students/${sid}/projects/${active}/run`, { entry: file })) } finally { setBusy(false) }
  })
  const create = () => act(async () => {
    const p = await api.post<Project>(`/students/${sid}/projects`, { name: newName || 'Untitled lab' })
    setNewName('')
    projects.reload()
    setActive(p.id)
    setFile('main.py')
  })
  const addFile = () => {
    const name = prompt('New file name (e.g. helpers.py, notes.md)')
    if (name) void act(async () => { await api.put(`/students/${sid}/projects/${active}/files/${name}`, { content: '' }); projects.reload(); setFile(name) })
  }
  return (
    <Panel title="My Laboratory" subtitle="Your local projects - stored on this computer, runnable in the sandbox" wide>
      <div className="grid h-[min(78vh,820px)] lg:grid-cols-[240px_1fr]">
        <aside className="scroll-thin space-y-3 overflow-y-auto border-r border-white/5 p-3">
          <div className="flex gap-1">
            <input className={`${inputCls} py-1.5`} placeholder="New project name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} />
            <Button tone="subtle" onClick={create} aria-label="Create project"><FolderPlus size={15} /></Button>
          </div>
          {projects.loading && <Spinner />}
          {projects.data?.map((p) => (
            <div key={p.id}>
              <button onClick={() => { setActive(p.id); setFile(p.files.some((f) => f.name === 'main.py') ? 'main.py' : p.files[0]?.name ?? 'main.py') }}
                className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${p.id === active ? 'bg-ink-700 text-white' : 'text-ink-200 hover:bg-ink-800'}`}>
                {p.name} {p.kind === 'mission' && <span className="text-[10px] text-ink-400">mission</span>}
              </button>
              {p.id === active && (
                <ul className="ml-2 mt-1 space-y-0.5 border-l border-ink-700 pl-2">
                  {p.files.map((f) => (
                    <li key={f.name}><button onClick={() => setFile(f.name)} className={`font-mono text-xs ${f.name === file ? 'text-teal' : 'text-ink-400 hover:text-white'}`}>{f.name}</button></li>
                  ))}
                  <li><button onClick={addFile} className="flex items-center gap-1 text-xs text-ink-400 hover:text-white"><FilePlus size={12} /> add file</button></li>
                </ul>
              )}
            </div>
          ))}
        </aside>
        <section className="flex min-h-0 flex-col">
          {!project ? <p className="p-5 text-sm text-ink-400">Create a project to start experimenting.</p> : <>
            <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-3 py-2">
              <span className="font-mono text-xs text-ink-200">{project.name}/{file}{dirty ? ' •' : ''}</span>
              <div className="ml-auto flex gap-2">
                <Button tone="ghost" onClick={save} disabled={!dirty}><Save size={14} /> Save</Button>
                {file.endsWith('.py') && <Button onClick={exec} disabled={busy}><Play size={14} /> {busy ? 'Running…' : 'Run'}</Button>}
                <Button tone="subtle" onClick={() => { if (confirm(`Delete project "${project.name}" and its files?`)) void act(async () => { await api.del(`/students/${sid}/projects/${project.id}`); setActive(null); projects.reload() }) }} aria-label="Delete project"><Trash2 size={14} /></Button>
              </div>
            </div>
            <ErrorNote error={error} />
            <div className="min-h-0 flex-1">
              {content === null ? <div className="p-4"><Spinner /></div> : (
                <Suspense fallback={<div className="p-4"><Spinner label="Loading editor" /></div>}>
                  <CodeEditor value={content} onChange={(v) => { setContent(v); setDirty(true) }} />
                </Suspense>
              )}
            </div>
            {run && (
              <div className="scroll-thin max-h-56 overflow-y-auto border-t border-white/5 bg-ink-950 p-3 font-mono text-xs">
                <div className="mb-1 text-ink-400">{run.timed_out ? 'Timed out' : `Finished in ${run.duration_ms} ms`} · sandbox: {run.isolation.os_sandbox}</div>
                <pre className="whitespace-pre-wrap text-ink-200">{run.stdout || '(no output)'}</pre>
                {run.error && <pre className="whitespace-pre-wrap text-red-300">{run.error}</pre>}
                {run.stderr && <pre className="whitespace-pre-wrap text-yellow-200">{run.stderr}</pre>}
              </div>
            )}
          </>}
        </section>
      </div>
    </Panel>
  )
}
