import { Clapperboard, Copy, Download, Github, Play, RotateCcw, Share2, Sparkles, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cardToBlob, drawCard } from '../components/engagement/shareCard'
import { EMOJI, judge, MAX_ATTEMPTS, type Outcome, type Puzzle, puzzleFor, puzzleNumber, PUZZLES, shareText } from './puzzles'
import { type NetConfig, type NetResult, train } from './sim'

const REPO = 'https://github.com/singhdeepesh20/Nexora-AI'
interface Attempt { config: NetConfig; result: NetResult; outcome: Outcome }
const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const store = {
  get: (k: string) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') } catch { return null } },
  set: (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } },
}

export function PlayApp() {
  const today = puzzleNumber()
  const [practice, setPractice] = useState<number | null>(null) // index into PUZZLES when practising
  const number = today
  const puzzle = practice === null ? puzzleFor(today) : PUZZLES[practice]
  const key = practice === null ? `nexora.play.${today}` : null
  const [values, setValues] = useState<Partial<NetConfig>>({})
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(false)
  const friend = useMemo(() => {
    const q = new URLSearchParams(location.search)
    const g = q.get('g'), d = Number(q.get('d'))
    if (!g || d !== today || !/^[RYG]{1,6}$/.test(g)) return null
    return g.split('').map((c) => (c === 'G' ? 'solved' : c === 'R' ? 'diverged' : 'failed') as Outcome)
  }, [today])

  // restore today's progress (per-device convenience only)
  useEffect(() => {
    setValues(Object.fromEntries(puzzle.controls.map((c) => [c.key, puzzle.config[c.key]])))
    if (key) {
      const saved = store.get(key) as { configs: NetConfig[] } | null
      setAttempts(saved?.configs?.map((cfg) => { const result = train(cfg); return { config: cfg, result, outcome: judge(result) } }) ?? [])
    } else setAttempts([])
  }, [puzzle.id, key]) // eslint-disable-line react-hooks/exhaustive-deps

  const solved = attempts.some((a) => a.outcome === 'solved')
  const over = solved || attempts.length >= MAX_ATTEMPTS
  const last = attempts.at(-1)

  const run = () => {
    if (over) return
    setBusy(true)
    setTimeout(() => { // let the button paint first; training takes ~20-60 ms
      const config = { ...puzzle.config, ...values } as NetConfig
      const result = train(config)
      const next = [...attempts, { config, result, outcome: judge(result) }]
      setAttempts(next)
      if (key) store.set(key, { configs: next.map((a) => a.config) })
      if (result.diverged && !reduceMotion()) { setShake(true); setTimeout(() => setShake(false), 650) }
      setBusy(false)
    }, 30)
  }

  return (
    <div className={`min-h-full overflow-y-auto bg-ink-950 ${shake ? 'nx-shake' : ''}`} style={{ height: '100%' }}>
      <style>{'@keyframes nxs{0%,100%{transform:none}20%{transform:translate(-6px,2px)}40%{transform:translate(5px,-3px)}60%{transform:translate(-4px,3px)}80%{transform:translate(3px,-1px)}} .nx-shake{animation:nxs .5s} @keyframes nxf{from{opacity:.55}to{opacity:0}} .nx-flash{animation:nxf .7s forwards}'}</style>
      {shake && <div className="nx-flash pointer-events-none fixed inset-0 z-50 bg-red-600" />}
      <main className="mx-auto max-w-2xl space-y-4 px-4 pb-16 pt-5">
        <header className="flex items-center justify-between">
          <a href={REPO} className="flex items-center gap-2 text-sm font-bold tracking-[0.25em] text-white">
            <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden><rect width="64" height="64" rx="14" fill="#11161c" /><path d="M16 46V18l32 28V18" fill="none" stroke="#2dd4bf" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            NEXORA
          </a>
          <span className="text-xs text-ink-400">{practice === null ? `Break of the Day #${number}` : 'Practice'} · <Countdown /></span>
        </header>

        <section>
          <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">Can you fix this <span className="text-teal">neural network?</span></h1>
          <p className="mt-1 text-sm text-ink-400">Real training, right in your browser. {MAX_ATTEMPTS} tries. No install, no account.</p>
        </section>

        {friend && practice === null && (
          <p className="rounded-xl border border-violet/40 bg-violet/10 px-4 py-2 text-sm text-ink-200">
            A friend shared their result: <b className="tracking-widest">{friend.map((o) => EMOJI[o]).join('')}</b>. Beat it.
            <span className="block text-[11px] text-ink-400">Shared in the link - not verified.</span>
          </p>
        )}

        <article className="glass rounded-2xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300">Broken: {puzzle.title}</div>
          <p className="mt-1 text-sm text-ink-200">{puzzle.story}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <LossCanvas result={last?.result} outcome={last?.outcome} key={attempts.length} />
            <BoundaryCanvas result={last?.result} />
          </div>
          {last && <Verdict a={last} />}
          {!over && (
            <div className="mt-4 space-y-3">
              {puzzle.controls.map((c) => <ControlInput key={c.key} control={c} value={values[c.key]} onChange={(v) => setValues({ ...values, [c.key]: v })} />)}
              <button onClick={run} disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal py-3.5 text-base font-bold text-ink-950 active:scale-[.98] disabled:opacity-50">
                <Play size={18} /> {busy ? 'Training…' : attempts.length ? `Train again (${MAX_ATTEMPTS - attempts.length} left)` : 'Train the network'}
              </button>
              {attempts.length >= 2 && !solved && <p className="text-xs text-yellow-200">Hint: {puzzle.hint}</p>}
            </div>
          )}
          {attempts.length > 0 && (
            <ol className="mt-4 space-y-1 text-xs text-ink-400" aria-label="Your attempts">
              {attempts.map((a, i) => (
                <li key={i}>{EMOJI[a.outcome]} #{i + 1} · {puzzle.controls.map((c) => `${c.label.toLowerCase()} ${fmt(a.config[c.key])}`).join(', ')} → train {pct(a.result.trainAcc)}, test {pct(a.result.testAcc)}</li>
              ))}
            </ol>
          )}
        </article>

        {over && <Finale puzzle={puzzle} attempts={attempts} number={practice === null ? number : null} />}

        <section className="flex flex-wrap gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-2 text-sm text-ink-200 hover:border-teal"
            onClick={() => setPractice(((practice ?? PUZZLES.indexOf(puzzleFor(today))) + 1) % PUZZLES.length)}>
            <RotateCcw size={14} /> {practice === null ? 'Practice another broken network' : 'Next practice puzzle'}
          </button>
          {practice !== null && <button className="rounded-lg border border-ink-600 px-3 py-2 text-sm text-ink-200" onClick={() => setPractice(null)}>Back to today&apos;s puzzle</button>}
        </section>

        <a href={REPO} className="glass block rounded-2xl p-4 hover:border-teal">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><Sparkles size={16} className="text-teal" /> This is one lab of NEXORA University</div>
          <p className="mt-1 text-xs text-ink-400">A free, open-source 3D university for AI engineers: walk the campus, break 14 more systems, pass real coding missions graded by hidden tests. Runs offline on your computer. →</p>
        </a>
        <p className="text-center text-[11px] text-ink-400">Everything runs in your browser. Nothing you do here is sent anywhere.</p>
      </main>
    </div>
  )
}

const fmt = (v: unknown) => (typeof v === 'number' ? (v < 0.01 ? v.toExponential(0) : Number(v.toPrecision(2)).toString()) : String(v))
const pct = (v: number) => `${Math.round(v * 100)}%`

function Countdown() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const end = new Date(); end.setHours(24, 0, 0, 0)
  const s = Math.max(0, Math.floor((end.getTime() - now) / 1000))
  return <span>next in {String(Math.floor(s / 3600)).padStart(2, '0')}:{String(Math.floor((s % 3600) / 60)).padStart(2, '0')}</span>
}

function Verdict({ a }: { a: Attempt }) {
  const text = { diverged: ['💥 Diverged', 'The loss exploded - the optimiser is overshooting.', 'text-red-300'],
    failed: ['🤔 Not learning enough', a.result.status === 'stalled' ? 'The loss barely moved.' : 'It learns, but not well enough.', 'text-yellow-200'],
    solved: ['✅ Fixed!', `Train ${pct(a.result.trainAcc)}, test ${pct(a.result.testAcc)}.`, 'text-teal'] }[a.outcome]
  return <p className={`mt-3 text-sm ${text[2]}`} role="status"><b>{text[0]}</b> <span className="text-ink-200">{text[1]}</span></p>
}

function ControlInput({ control: c, value, onChange }: { control: Puzzle['controls'][number]; value: unknown; onChange: (v: number | string) => void }) {
  if (c.kind === 'choice') {
    return (
      <div><div className="mb-1 text-xs text-ink-400">{c.label}</div>
        <div className="flex gap-2">{c.options!.map((o) => (
          <button key={o} onClick={() => onChange(o)} className={`flex-1 rounded-lg border px-3 py-2 text-sm ${value === o ? 'border-teal bg-teal/10 text-white' : 'border-ink-600 text-ink-200'}`}>{o}</button>
        ))}</div></div>
    )
  }
  const lo = c.min!, hi = c.max!
  const toSlider = (v: number) => (c.kind === 'log' ? ((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * 100 : v)
  const fromSlider = (s: number) => (c.kind === 'log' ? Number((10 ** (Math.log10(lo) + (s / 100) * (Math.log10(hi) - Math.log10(lo)))).toPrecision(2)) : Math.round(s))
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs text-ink-400"><span>{c.label}</span><b className="font-mono text-white">{fmt(value)}</b></span>
      <input type="range" className="w-full accent-teal-400" min={c.kind === 'log' ? 0 : lo} max={c.kind === 'log' ? 100 : hi} step={1}
        value={toSlider(value as number)} onChange={(e) => onChange(fromSlider(Number(e.target.value)))} aria-valuetext={`${c.label} ${fmt(value)}`} />
    </label>
  )
}

/** Animated loss curve: draws the real training history over ~1.2 s. */
function LossCanvas({ result, outcome }: { result?: NetResult; outcome?: Outcome }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current, ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const W = c.width, H = c.height
    let raf = 0
    const draw = (frac: number) => {
      ctx.fillStyle = '#0b1016'; ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#6b7a8c'; ctx.font = '22px ui-sans-serif, system-ui'; ctx.fillText('loss', 14, 30)
      if (!result) { ctx.fillText('press Train', W / 2 - 60, H / 2); return }
      const L = result.losses, max = Math.max(...L) * 1.05, n = Math.max(2, Math.ceil(L.length * frac))
      ctx.strokeStyle = outcome === 'diverged' ? '#ef4444' : outcome === 'solved' ? '#2dd4bf' : '#facc15'
      ctx.lineWidth = 4; ctx.beginPath()
      for (let i = 0; i < n; i++) { const x = 10 + (i / (L.length - 1)) * (W - 20), y = H - 12 - (L[i] / max) * (H - 50); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) }
      ctx.stroke()
    }
    if (reduceMotion() || !result) draw(1)
    else { const t0 = performance.now(); const tick = (t: number) => { const f = Math.min(1, (t - t0) / 1200); draw(f); if (f < 1) raf = requestAnimationFrame(tick) }; raf = requestAnimationFrame(tick) }
    return () => cancelAnimationFrame(raf)
  }, [result, outcome])
  return <canvas ref={ref} width={420} height={300} className="w-full rounded-xl border border-ink-700" role="img" aria-label={result ? `Loss from ${result.losses[0].toFixed(2)} to ${result.losses.at(-1)!.toFixed(2)}` : 'Loss curve'} />
}

/** What the network actually learned: its decision regions plus the data points. */
function BoundaryCanvas({ result }: { result?: NetResult }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current, ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const W = c.width, H = c.height
    ctx.fillStyle = '#0b1016'; ctx.fillRect(0, 0, W, H)
    if (!result) return
    const n = result.grid.length, cw = W / n, ch = H / n
    result.grid.forEach((row, r) => row.forEach((p, k) => {
      ctx.fillStyle = `rgba(${Math.round(56 + (244 - 56) * p)},${Math.round(189 - 75 * p)},${Math.round(248 - 66 * p)},0.35)`
      ctx.fillRect(k * cw, r * ch, cw + 1, ch + 1)
    }))
    for (const pt of result.points) {
      const x = ((pt.x + 1.6) / 3.2) * W, y = ((1.6 - pt.y) / 3.2) * H
      ctx.fillStyle = pt.label ? '#f472b6' : '#38bdf8'
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill()
    }
  }, [result])
  return <canvas ref={ref} width={300} height={300} className="w-full rounded-xl border border-ink-700" role="img" aria-label="Decision regions learned by the network" />
}

function Finale({ puzzle, attempts, number }: { puzzle: Puzzle; attempts: Attempt[]; number: number | null }) {
  const outcomes = attempts.map((a) => a.outcome)
  const solved = outcomes.at(-1) === 'solved'
  const [msg, setMsg] = useState('')
  const [clip, setClip] = useState(false)
  const local = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname)
  const link = `${location.origin}${location.pathname}?d=${number}&g=${outcomes.map((o) => (o === 'solved' ? 'G' : o === 'diverged' ? 'R' : 'Y')).join('')}`
  const text = number === null ? '' : shareText(number, outcomes, link)
  const card = () => {
    const c = document.createElement('canvas')
    drawCard(c, {
      layout: 'daily', eyebrow: number === null ? 'PRACTICE' : `BREAK OF THE DAY #${number}`, title: solved ? 'NETWORK FIXED' : 'SO CLOSE',
      headline: puzzle.title, grid: [outcomes.map((o) => o === 'solved')],
      stats: [{ label: 'Attempts', value: `${solved ? outcomes.length : 'X'}/${MAX_ATTEMPTS}` }, { label: 'Final test accuracy', value: pct(attempts.at(-1)!.result.testAcc) }],
      rank: 'Can you fix it?', footer: 'LEARN AI BY ENGINEERING AI.', name: null, verified_at: null,
    })
    return c
  }
  const share = async () => {
    const file = new File([await cardToBlob(card())], `nexora-break-${number ?? 'practice'}.png`, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ text, files: [file] }) } catch { /* cancelled */ } return }
    if (navigator.share) { try { await navigator.share({ text }) } catch { /* cancelled */ } return }
    await navigator.clipboard.writeText(text); setMsg('Result copied - paste it anywhere.')
  }
  const download = async () => {
    const url = URL.createObjectURL(await cardToBlob(card()))
    Object.assign(document.createElement('a'), { href: url, download: `nexora-break-${number ?? 'practice'}.png` }).click()
    URL.revokeObjectURL(url)
  }
  return (
    <section className={`glass rounded-2xl p-4 ${solved ? 'border-teal/40' : ''}`}>
      <h2 className="text-xl font-bold text-white">{solved ? `Fixed in ${outcomes.length}/${MAX_ATTEMPTS} 🎉` : 'Out of tries'}</h2>
      <p className="mt-1 text-2xl tracking-widest">{outcomes.map((o) => EMOJI[o]).join('')}</p>
      <p className="mt-2 text-sm text-ink-200">{puzzle.explanation}</p>
      {number !== null && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => void share()} className="flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2.5 text-sm font-bold text-ink-950"><Share2 size={15} /> Share result</button>
          <button onClick={() => { void navigator.clipboard.writeText(text); setMsg('Result copied.') }} className="flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-2 text-sm text-ink-200"><Copy size={14} /> Copy</button>
          <button onClick={() => void download()} className="flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-2 text-sm text-ink-200"><Download size={14} /> Card</button>
          <button onClick={() => setClip(true)} className="flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-2 text-sm text-ink-200"><Clapperboard size={14} /> 10s clip</button>
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-teal">{msg}</p>}
      {number !== null && <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-ink-950 p-3 font-mono text-xs text-ink-200">{text}</pre>}
      {local && <p className="mt-2 text-[11px] text-ink-400">This copy runs on your own computer, so the link only works for friends once NEXORA Play is published online.</p>}
      {clip && <ClipMaker attempts={attempts} puzzle={puzzle} number={number} onDone={() => setClip(false)} />}
      <a href="https://github.com/singhdeepesh20/Nexora-AI" className="mt-3 flex items-center gap-1.5 text-xs text-ink-400 hover:text-white"><Github size={13} /> Get the full NEXORA University <Zap size={12} /></a>
    </section>
  )
}

/** Renders a 10-second vertical clip (720×1280 WebM) of the real attempts: the explosion, then the fix. */
function ClipMaker({ attempts, puzzle, number, onDone }: { attempts: Attempt[]; puzzle: Puzzle; number: number | null; onDone: () => void }) {
  const [state, setState] = useState<'recording' | 'unsupported' | 'error'>('recording')
  useEffect(() => {
    const c = document.createElement('canvas')
    c.width = 720; c.height = 1280
    const ctx = c.getContext('2d')!
    if (!('MediaRecorder' in window) || !c.captureStream) { setState('unsupported'); return }
    const scenes = [attempts.find((a) => a.outcome !== 'solved'), attempts.find((a) => a.outcome === 'solved')].filter(Boolean) as Attempt[]
    const rec = new MediaRecorder(c.captureStream(30), { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => chunks.push(e.data)
    rec.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }))
      Object.assign(document.createElement('a'), { href: url, download: `nexora-break-${number ?? 'practice'}.webm` }).click()
      URL.revokeObjectURL(url); onDone()
    }
    const per = 10000 / Math.max(1, scenes.length)
    const t0 = performance.now()
    let raf = 0
    const frame = (t: number) => {
      const el = t - t0
      const i = Math.min(scenes.length - 1, Math.floor(el / per)), f = Math.min(1, ((el - i * per) / per) * 1.6)
      const a = scenes[i]
      ctx.fillStyle = '#07090c'; ctx.fillRect(0, 0, 720, 1280)
      ctx.fillStyle = '#2dd4bf'; ctx.font = '800 44px ui-sans-serif, system-ui'; ctx.fillText('NEXORA', 60, 110)
      ctx.fillStyle = '#ffffff'; ctx.font = '800 58px ui-sans-serif, system-ui'
      ctx.fillText(a.outcome === 'solved' ? 'FIXED ✅' : 'BROKEN 💥', 60, 260)
      ctx.fillStyle = '#c6d0db'; ctx.font = '500 34px ui-sans-serif, system-ui'
      ctx.fillText(puzzle.controls.map((c) => `${c.label}: ${fmt(a.config[c.key])}`).join('  '), 60, 330)
      const L = a.result.losses, max = Math.max(...L) * 1.05, n = Math.max(2, Math.ceil(L.length * f))
      ctx.strokeStyle = a.outcome === 'solved' ? '#2dd4bf' : '#ef4444'; ctx.lineWidth = 8; ctx.beginPath()
      for (let k = 0; k < n; k++) { const x = 60 + (k / (L.length - 1)) * 600, y = 1000 - (L[k] / max) * 560; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y) }
      ctx.stroke()
      ctx.fillStyle = '#6b7a8c'; ctx.font = '500 30px ui-sans-serif, system-ui'; ctx.fillText('training loss (real run)', 60, 1060)
      ctx.fillStyle = '#ffffff'; ctx.font = '700 40px ui-sans-serif, system-ui'; ctx.fillText('Can you fix it?', 60, 1180)
      if (el < 10000) raf = requestAnimationFrame(frame); else rec.stop()
    }
    try { rec.start(); raf = requestAnimationFrame(frame) } catch { setState('error') }
    return () => cancelAnimationFrame(raf)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return <p className="mt-2 text-xs text-ink-400">{state === 'recording' ? 'Recording a 10-second clip… it downloads automatically.' : 'Your browser cannot record video here - share the card instead.'}</p>
}
