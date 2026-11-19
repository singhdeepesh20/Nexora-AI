import { Award, Play, Share2, SkipForward, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ChallengeResult } from '@nexora/shared-types'
import { prefersReducedMotion } from '../../engine/simEvents'
import { api } from '../../services/api'
import { useApp } from '../../stores/app'
import { LineChart } from '../ui/charts'
import { Button, ErrorNote } from '../ui/primitives'
import { EventBanner } from './EventBanner'

const ID = 'onboarding.first_experiment'
const INITIAL_LR = 20
type Step = 'welcome' | 'experiment' | 'done'

const LINES = {
  welcome: "Welcome to NEXORA. Here, you don't just study intelligent systems. You build them, test them, and sometimes break them. Let's begin.",
  intro: 'This neural network should learn XOR - but someone configured it badly. Press Train and watch the Experiment Machine behind you.',
  failed: "Interesting. You didn't break the network. You exposed a problem in the optimization process. Look at the loss: it rises instead of falling. Try a smaller learning rate.",
  stillFailing: 'Closer? Check the loss curve again. Every step is still overshooting - the learning rate is the only thing you need to change.',
  passed: 'Now you understand something important. An algorithm can be mathematically correct and still fail because of its configuration.',
}

/** Learning-rate slider on a log scale: 0.01 ... 20. */
const toLr = (v: number) => Number((10 ** (-2 + (v / 100) * Math.log10(2000))).toPrecision(2))
const fromLr = (lr: number) => ((Math.log10(lr) + 2) / Math.log10(2000)) * 100

export function Onboarding() {
  const { student, updateSettings, applyResult, closeAll, open } = useApp()
  const sid = student!.id
  const reduce = prefersReducedMotion(student?.settings.reduced_motion)
  const [step, setStep] = useState<Step>('welcome')
  const [lr, setLr] = useState(INITIAL_LR)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [results, setResults] = useState<ChallengeResult[]>([])
  const last = results[results.length - 1]

  useEffect(() => {
    if (!student?.settings.onboarding_started_at) void updateSettings({ onboarding_started_at: new Date().toISOString() })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const train = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await api.post<ChallengeResult>(`/students/${sid}/challenges/${ID}/attempt`, { config: { learning_rate: lr } })
      setResults((xs) => [...xs, r])
      await applyResult(r)
      if (r.passed) {
        await updateSettings({ onboarding: 'done', onboarding_completed_at: new Date().toISOString() })
        setStep('done')
      }
    } catch (e) { setError(e) } finally { setBusy(false) }
  }
  const skip = async () => { await updateSettings({ onboarding: 'skipped' }); closeAll() }

  const critical = last?.events.some((e) => e.severity === 'critical')
  const say = step === 'welcome' ? LINES.welcome : step === 'done' ? LINES.passed
    : !last ? LINES.intro : last.passed ? LINES.passed : results.length > 1 ? LINES.stillFailing : LINES.failed
  const hist = last?.result.history as { epoch: number[]; train_loss: number[]; test_loss: number[] } | undefined
  const pass = results.find((r) => r.passed)
  const seconds = useMemo(() => {
    const a = student?.settings.onboarding_started_at, b = student?.settings.onboarding_completed_at
    return a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 1000) : null
  }, [student?.settings])

  return (
    <aside role="dialog" aria-label="Your first experiment"
      className="glass animate-in absolute bottom-3 right-3 top-20 z-30 flex w-[min(460px,calc(100%-24px))] flex-col overflow-hidden rounded-2xl shadow-2xl">
      <header className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-ink-950" style={{ background: '#f472b6' }}>N</div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">Professor Nova</div>
          <div className="text-[11px] text-ink-400">Your first experiment · about 2 minutes</div>
        </div>
        {step !== 'done' && <button onClick={() => void skip()} className="flex items-center gap-1 text-xs text-ink-400 hover:text-white"><SkipForward size={13} /> Skip</button>}
        {step === 'done' && <button onClick={closeAll} aria-label="Close" className="text-ink-400 hover:text-white"><X size={16} /></button>}
      </header>
      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-4">
        <p className="rounded-2xl rounded-tl-sm border border-[#f472b6]/30 bg-[#f472b6]/10 px-4 py-3 text-sm text-ink-200" aria-live="polite">{say}</p>

        {step === 'welcome' && <Button className="w-full" onClick={() => setStep('experiment')}>Let&apos;s begin</Button>}

        {step !== 'welcome' && (
          <>
            <div className="rounded-xl border border-ink-700 bg-ink-950/60 p-3">
              <div className="mb-1 flex justify-between text-[11px] text-ink-400"><span>XOR network · 2 → 8 → 1</span><span>{critical ? '⚠ unstable' : last?.passed ? '✓ stable' : 'untrained'}</span></div>
              <NetworkViz state={critical ? 'critical' : last?.passed ? 'success' : 'idle'} reduce={reduce} />
            </div>
            {step === 'experiment' && (
              <div className="space-y-2">
                <label className="block text-xs text-ink-200" htmlFor="lr">
                  Learning rate: <b className="font-mono text-white">{lr}</b>
                  {lr === INITIAL_LR && <span className="ml-2 text-red-300">(the broken setting)</span>}
                </label>
                <input id="lr" type="range" min={0} max={100} step={1} value={fromLr(lr)} onChange={(e) => setLr(toLr(Number(e.target.value)))}
                  className="w-full accent-teal-400" aria-valuetext={`learning rate ${lr}`} />
                <div className="flex justify-between text-[10px] text-ink-400"><span>0.01</span><span>0.1</span><span>1</span><span>20</span></div>
                <Button className="w-full" onClick={() => void train()} disabled={busy}><Play size={15} /> {busy ? 'Training…' : results.length ? 'Train again' : 'Train'}</Button>
              </div>
            )}
            <ErrorNote error={error} />
            {last && <EventBanner events={last.events} />}
            {hist && (
              <LineChart x={hist.epoch} yLabel="Loss" xLabel="epochs"
                series={[{ name: 'train loss', values: hist.train_loss, color: '#38bdf8' }, { name: 'test loss', values: hist.test_loss, color: '#f472b6' }]} />
            )}
            {results.length > 0 && (
              <ol className="space-y-1 text-xs text-ink-400" aria-label="Attempts">
                {results.map((r, i) => (
                  <li key={r.attempt_id}>Attempt {i + 1}: η = {String(r.config.learning_rate)} → train {pct(r.metrics.train_acc)}, test {pct(r.metrics.test_acc)} {r.passed ? '✓ passed' : '✗'}</li>
                ))}
              </ol>
            )}
          </>
        )}

        {step === 'done' && pass && (
          <section className="rounded-xl border border-teal/40 bg-teal/5 p-4">
            <h3 className="flex items-center gap-2 font-semibold text-teal"><Award size={18} /> First Experiment Completed</h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-ink-400">Attempts</dt><dd className="text-white">{results.indexOf(pass) + 1}</dd>
              <dt className="text-ink-400">Learning rate</dt><dd className="font-mono text-white">{String(pass.config.learning_rate)}</dd>
              <dt className="text-ink-400">Verified result</dt><dd className="text-white">train {pct(pass.metrics.train_acc)} · test {pct(pass.metrics.test_acc)}</dd>
              {seconds !== null && <><dt className="text-ink-400">Time</dt><dd className="text-white">{Math.floor(seconds / 60)}m {seconds % 60}s</dd></>}
            </dl>
            <p className="mt-3 text-xs text-ink-200">{pass.explanation}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button tone="ghost" onClick={() => open({ kind: 'share', card: 'challenge', ref: ID })}><Share2 size={14} /> Share card</Button>
              <Button onClick={closeAll}>Explore the campus</Button>
            </div>
          </section>
        )}
      </div>
    </aside>
  )
}

const pct = (v: unknown) => (typeof v === 'number' ? `${(v * 100).toFixed(0)}%` : '—')

/** Schematic 2-8-1 network. Edges turn red and jitter when the real run diverged (no jitter in reduced motion). */
function NetworkViz({ state, reduce }: { state: 'idle' | 'critical' | 'success'; reduce: boolean }) {
  const layers = [2, 8, 1]
  const W = 400, H = 150
  const pos = layers.map((n, li) => Array.from({ length: n }, (_, i) => [40 + li * 160, ((i + 1) * H) / (n + 1)] as const))
  const color = state === 'critical' ? '#ef4444' : state === 'success' ? '#2dd4bf' : '#475569'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`w-full ${state === 'critical' && !reduce ? 'nx-jitter' : ''}`} role="img"
      aria-label={`Network diagram, state ${state}`}>
      <style>{'@keyframes nxj{0%{transform:translate(0,0)}25%{transform:translate(1.5px,-1px)}50%{transform:translate(-1px,1.5px)}75%{transform:translate(1px,1px)}100%{transform:translate(0,0)}} .nx-jitter{animation:nxj .12s linear infinite}'}</style>
      {pos.slice(0, -1).flatMap((a, li) => a.flatMap(([x1, y1], i) => pos[li + 1].map(([x2, y2], j) => (
        <line key={`${li}-${i}-${j}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeOpacity={state === 'idle' ? 0.35 : 0.6}
          strokeWidth={state === 'critical' ? 1 + ((i * 7 + j * 3) % 4) : 1.2} />
      ))))}
      {pos.flat().map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={7} fill="#0d1117" stroke={color} strokeWidth={2} />
      ))}
    </svg>
  )
}
