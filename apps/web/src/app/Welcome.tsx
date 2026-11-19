import { ChevronRight, ShieldCheck, Trash2, WifiOff } from 'lucide-react'
import { useState } from 'react'
import { lastStudentId, useApp } from '../stores/app'
import { Button, ErrorNote, Field, inputCls } from '../components/ui/primitives'
import { Logo } from './App'

const PALETTE = ['#2dd4bf', '#38bdf8', '#a78bfa', '#f472b6', '#facc15', '#fb923c', '#4ade80', '#e2e8f0']

export function Welcome() {
  const { students, selectStudent, createStudent, system } = useApp()
  const [creating, setCreating] = useState(students.length === 0)
  const [name, setName] = useState('')
  const [body, setBody] = useState(PALETTE[0])
  const [accent, setAccent] = useState(PALETTE[1])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const last = lastStudentId()
  const ordered = [...students].sort((a, b) => (a.id === last ? -1 : b.id === last ? 1 : 0))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try { await createStudent(name, body, accent) } catch (err) { setError(err) } finally { setBusy(false) }
  }

  return (
    <div className="relative h-full overflow-y-auto bg-ink-950">
      <div className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: 'radial-gradient(60% 50% at 20% 10%, #0f766e55, transparent), radial-gradient(50% 50% at 90% 80%, #0c4a6e66, transparent)' }} />
      <main className="relative mx-auto grid min-h-full max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.1fr_1fr]">
        <section className="min-w-0">
          <div className="flex items-center gap-3"><Logo size={44} /><span className="text-xl font-bold tracking-[0.3em] text-white">NEXORA</span></div>
          <h1 className="mt-8 text-4xl font-bold leading-tight text-white sm:text-5xl">Learn AI by<br /><span className="text-teal">breaking it.</span></h1>
          <p className="mt-5 max-w-lg text-ink-200">Your first job: a neural network is broken and you have to fix it. Then walk into NEXORA University - real simulations, coding missions graded by hidden tests, and proof of skill you can share. Built for CS students heading into AI engineering.</p>
          <a href="./play.html" className="mt-4 inline-flex items-center gap-2 rounded-lg border border-teal/50 px-3 py-2 text-sm text-teal hover:bg-teal/10">⚡ Try today&apos;s 60-second Break of the Day</a>
          <ul className="mt-6 space-y-2 text-sm text-ink-400">
            <li className="flex items-center gap-2"><WifiOff size={15} className="text-sky" /> Works offline. No account, no cloud, no AI model required.</li>
            <li className="flex items-center gap-2"><ShieldCheck size={15} className="text-sky" /> Your data stays on this device and can be exported any time.</li>
          </ul>
          <p className="mt-8 text-xs text-ink-400">Explore → Understand → Experiment → Engineer → Debug → Validate → Master</p>
        </section>

        <section className="glass animate-in min-w-0 rounded-2xl p-6">
          {!creating ? (
            <>
              <h2 className="text-lg font-semibold text-white">Choose your profile</h2>
              <ul className="mt-4 space-y-2">
                {ordered.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => void selectStudent(s)}
                      className="flex w-full items-center gap-3 rounded-xl border border-ink-700 bg-ink-800/60 px-3 py-3 text-left hover:border-teal">
                      <span className="grid h-10 w-10 place-items-center rounded-lg font-bold text-ink-950" style={{ background: s.avatar?.body_color }}>
                        {s.display_name[0]?.toUpperCase()}
                      </span>
                      <span className="flex-1">
                        <span className="block font-medium text-white">{s.display_name}</span>
                        <span className="text-xs text-ink-400">Joined {new Date(s.created_at).toLocaleDateString()}</span>
                      </span>
                      <ChevronRight size={18} className="text-ink-400" />
                    </button>
                  </li>
                ))}
              </ul>
              <Button tone="ghost" className="mt-4 w-full" onClick={() => setCreating(true)}>New local profile</Button>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-white">Create your student profile</h2>
                <p className="mt-1 text-sm text-ink-400">Stored only on this computer - no registration.</p>
              </div>
              <Field label="Display name">
                <input autoFocus required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Ada" />
              </Field>
              <ColorRow label="Suit colour" value={body} onChange={setBody} />
              <ColorRow label="Visor colour" value={accent} onChange={setAccent} />
              <ErrorNote error={error} />
              <div className="flex gap-2">
                {students.length > 0 && <Button type="button" tone="ghost" onClick={() => setCreating(false)}>Cancel</Button>}
                <Button type="submit" className="flex-1" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Enter the campus'}</Button>
              </div>
            </form>
          )}
          {system && <p className="mt-6 text-[11px] text-ink-400"><Trash2 size={11} className="mr-1 inline" />Data folder: <code className="break-all text-ink-200">{system.data_dir}</code></p>}
        </section>
      </main>
    </div>
  )
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-ink-400">{label}</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {PALETTE.map((c) => (
          <button type="button" key={c} role="radio" aria-checked={value === c} aria-label={c} onClick={() => onChange(c)}
            className={`h-8 w-8 rounded-lg border-2 ${value === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />
        ))}
      </div>
    </div>
  )
}
