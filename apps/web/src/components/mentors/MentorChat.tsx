import { Bot, Cpu, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { AIStatus, ChatResponse, Mentor, MentorMode } from '@nexora/shared-types'
import { useAsync } from '../../hooks/useAsync'
import { api } from '../../services/api'
import { useApp } from '../../stores/app'
import { Markdown } from '../ui/Markdown'
import { Badge, Button, ErrorNote, Panel, inputCls } from '../ui/primitives'

interface Msg { role: 'student' | 'mentor'; content: string; source?: string; refs?: ChatResponse['references']; mode?: string }
const MODES: [MentorMode, string][] = [['auto', 'Auto'], ['explain', 'Explain'], ['socratic', 'Socratic'], ['coding', 'Coding mentor'], ['research', 'Research mentor']]

export function MentorChat({ mentorId, prompt }: { mentorId: string; prompt?: string }) {
  const { student, celebrate } = useApp()
  const mentors = useAsync(() => api.get<Mentor[]>('/mentors'), [])
  const ai = useAsync(() => api.get<AIStatus>('/ai/status'), [])
  const [current, setCurrent] = useState(mentorId)
  const m = mentors.data?.find((x) => x.id === current)
  const [mode, setMode] = useState<MentorMode>(student?.settings.mentor_mode ?? 'auto')
  const [text, setText] = useState(prompt ? `Explain ${prompt}` : '')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [conv, setConv] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { void end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])
  const model = student?.settings.mentor_model && ai.data?.models.some((x) => x.name === student.settings.mentor_model) ? student.settings.mentor_model : null

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = text.trim()
    if (!q) return
    setText('')
    setMsgs((x) => [...x, { role: 'student', content: q }])
    setBusy(true)
    setError(null)
    try {
      const r = await api.post<ChatResponse>(`/students/${student!.id}/mentors/${current}/chat`, { message: q, mode, conversation_id: conv, model })
      setConv(r.conversation_id)
      setMsgs((x) => [...x, { role: 'mentor', content: r.reply, source: r.source, refs: r.references, mode: r.mode }])
      celebrate((r as ChatResponse & { achievements?: [] }).achievements)
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return (
    <Panel title={m ? `Professor ${m.name}` : 'Mentor'} subtitle={m ? `${m.domain} · ${m.style}` : undefined} accent={m?.color}
      actions={<Badge color={model ? '#2dd4bf' : '#94a3b8'}>{model ? <><Cpu size={11} className="mr-1" />{model}</> : 'offline mode'}</Badge>}>
      <div className="flex h-[min(74vh,760px)] flex-col">
        <div className="flex flex-wrap gap-2 border-b border-white/5 px-4 py-2">
          <select className={`${inputCls} w-auto py-1 text-xs`} value={current} onChange={(e) => { setCurrent(e.target.value); setConv(null); setMsgs([]) }} aria-label="Professor">
            {mentors.data?.map((x) => <option key={x.id} value={x.id}>{x.name} - {x.domain}</option>)}
          </select>
          <div className="flex gap-1 rounded-lg bg-ink-800 p-0.5" role="radiogroup" aria-label="Mentor mode">
            {MODES.map(([k, l]) => <button key={k} role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={`rounded-md px-2 py-1 text-xs ${mode === k ? 'bg-ink-600 text-white' : 'text-ink-400'}`}>{l}</button>)}
          </div>
        </div>
        <div className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4">
          {msgs.length === 0 && (
            <div className="rounded-xl border border-dashed border-ink-600 p-4 text-sm text-ink-400">
              <p className="flex items-center gap-2 text-ink-200"><Bot size={16} /> Ask about any concept, paste an error message, or ask for help designing an experiment.</p>
              {!model && <p className="mt-2 text-xs">No local AI model is selected, so answers come straight from the curriculum (deterministic and offline). To enable conversational answers, install Ollama yourself and choose a model in Settings - NEXORA never downloads models.</p>}
            </div>
          )}
          {msgs.map((x, i) => (
            <div key={i} className={x.role === 'student' ? 'ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-teal/15 px-3.5 py-2 text-sm text-white' : 'max-w-[92%] rounded-2xl rounded-bl-sm border border-ink-700 bg-ink-800/70 px-4 py-3'}>
              {x.role === 'student' ? x.content : <>
                <Markdown source={x.content} className="text-sm" />
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-ink-400">
                  <span>mode: {x.mode}</span><span>· source: {x.source}</span>
                  {x.refs?.map((r) => <Badge key={r.concept_id + r.title} color="#38bdf8">{r.title}</Badge>)}
                </div>
              </>}
            </div>
          ))}
          {busy && <p className="text-xs text-ink-400">Professor is thinking…</p>}
          <ErrorNote error={error} />
          <div ref={end} />
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-white/5 p-3">
          <textarea className={`${inputCls} h-12 resize-none`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a question… (Shift+Enter for a new line)"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }} aria-label="Message" />
          <Button type="submit" disabled={busy || !text.trim()} aria-label="Send"><Send size={15} /></Button>
        </form>
      </div>
    </Panel>
  )
}
