import { FlaskConical, Play } from 'lucide-react'
import { useCallback, useState, type ReactNode } from 'react'
import type { SimulationResponse } from '@nexora/shared-types'
import { api } from '../../services/api'
import { useApp } from '../../stores/app'
import { Heatmap, LineChart, MatrixTable } from '../ui/charts'
import { Badge, Button, ErrorNote, Panel, Spinner, inputCls } from '../ui/primitives'
import { Notes, Num, Presets, Select, Stat, Toggle } from './controls'

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = any

const TITLES: Record<string, [string, string, string]> = {
  gradient_descent: ['Gradient Descent Laboratory', 'Real optimisation on analytic functions', '#38bdf8'],
  neural_network: ['Neural Network Laboratory', 'NumPy multilayer perceptron with backpropagation', '#a78bfa'],
  ml_lab: ['Machine Learning Laboratory', 'scikit-learn on bundled offline datasets', '#38bdf8'],
  rag: ['RAG Retrieval Laboratory', 'BM25 lexical retrieval over the NEXORA curriculum', '#a78bfa'],
  transformer: ['Transformer Laboratory', 'Explanatory toy model - untrained random weights', '#a78bfa'],
  infrastructure: ['AI Infrastructure Laboratory', 'Analytical estimates + a real benchmark of this machine', '#2dd4bf'],
}

function useSim(simId: string) {
  const { student, celebrate } = useApp()
  const [res, setRes] = useState<SimulationResponse<R> | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const run = useCallback(async (config: Record<string, unknown>) => {
    setBusy(true)
    setError(null)
    try {
      const r = await api.post<SimulationResponse<R>>(`/students/${student!.id}/simulations/${simId}/run`, { config, save: true })
      setRes(r)
      celebrate(r.achievements)
    } catch (e) { setError(e) } finally { setBusy(false) }
  }, [simId, student, celebrate])
  return { res, error, busy, run }
}

function LabShell({ simId, controls, onRun, busy, error, res, children }: {
  simId: string; controls: ReactNode; onRun: () => void; busy: boolean; error: unknown; res: SimulationResponse<R> | null; children: ReactNode
}) {
  const [title, subtitle, accent] = TITLES[simId]
  return (
    <Panel title={title} subtitle={subtitle} accent={accent} wide>
      <div className="grid gap-5 p-5 lg:grid-cols-[280px_1fr]">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onRun() }}>
          {controls}
          <Button type="submit" className="w-full" disabled={busy}><Play size={15} /> {busy ? 'Running…' : 'Run experiment'}</Button>
          <ErrorNote error={error} />
          {res?.experiment_id && <p className="text-[11px] text-ink-400">Saved as a reproducible experiment (engine v{res.version}). Same configuration → same result.</p>}
        </form>
        <section className="min-w-0 space-y-4">
          {busy && !res && <Spinner label="Computing" />}
          {!res && !busy && <div className="grid h-64 place-items-center rounded-xl border border-dashed border-ink-600 text-sm text-ink-400"><span className="flex items-center gap-2"><FlaskConical size={16} /> Configure the experiment and press Run.</span></div>}
          {res && children}
        </section>
      </div>
    </Panel>
  )
}

export function LabPanel({ simId }: { simId: string }) {
  switch (simId) {
    case 'gradient_descent': return <GradientLab />
    case 'neural_network': return <NeuralLab />
    case 'ml_lab': return <MLLab />
    case 'rag': return <RAGLab />
    case 'transformer': return <TransformerLab />
    case 'infrastructure': return <InfraLab />
    default: return <Panel title="Unknown laboratory"><p className="p-5 text-sm">No such laboratory.</p></Panel>
  }
}

/* ------------------------------------------------------------------ gradient descent */
function GradientLab() {
  const sim = useSim('gradient_descent')
  const [c, setC] = useState({ function: 'quadratic', a: 1, b: 1, optimizer: 'gd', learning_rate: 0.1, momentum: 0.9, iterations: 100, start_x: -4, start_y: 3 })
  const set = (p: Partial<typeof c>) => setC({ ...c, ...p })
  const r = sim.res?.result
  const overlay = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!r) return
    const xs = r.grid.x as number[], ys = r.grid.y as number[]
    const X = (x: number) => ((x - xs[0]) / (xs[xs.length - 1] - xs[0])) * w
    const Y = (y: number) => h - ((y - ys[0]) / (ys[ys.length - 1] - ys[0])) * h
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 2
    ctx.beginPath()
    ;(r.path as [number | null, number | null][]).forEach(([x, y], i) => {
      if (x === null || y === null) return
      const px = Math.max(-50, Math.min(w + 50, X(x))), py = Math.max(-50, Math.min(h + 50, Y(y)))
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    })
    ctx.stroke()
    const [sx, sy] = r.path[0]
    ctx.fillStyle = '#f8fafc'
    ctx.beginPath(); ctx.arc(X(sx), Y(sy), 5, 0, Math.PI * 2); ctx.fill()
  }, [r])
  const grid = r ? (() => {
    const z = (r.grid.z as number[][]).slice().reverse()
    const min = Math.min(...z.flat())
    return min >= 0 ? z.map((row) => row.map((v) => Math.log1p(v - min))) : z
  })() : []
  return (
    <LabShell simId="gradient_descent" onRun={() => sim.run(c)} {...sim} controls={<>
      <Select label="Objective function" value={c.function} onChange={(v) => set({ function: v })}
        options={[['quadratic', 'Quadratic bowl a·x² + b·y²'], ['rosenbrock', 'Rosenbrock valley'], ['himmelblau', 'Himmelblau (4 minima)'], ['saddle', 'Saddle a·x² − b·y²']]} />
      {(c.function === 'quadratic' || c.function === 'saddle') && (
        <div className="grid grid-cols-2 gap-2"><Num label="a (x curvature)" value={c.a} onChange={(a) => set({ a })} /><Num label="b (y curvature)" value={c.b} onChange={(b) => set({ b })} /></div>
      )}
      <Select label="Optimiser" value={c.optimizer} onChange={(v) => set({ optimizer: v })} options={[['gd', 'Gradient descent'], ['momentum', 'Momentum'], ['rmsprop', 'RMSProp'], ['adam', 'Adam']]} />
      <Num label="Learning rate η" value={c.learning_rate} onChange={(v) => set({ learning_rate: v })} />
      <Presets items={[
        { label: 'Safe η=0.1', apply: () => set({ learning_rate: 0.1 }) },
        { label: 'Near limit η=0.95', apply: () => set({ learning_rate: 0.95, function: 'quadratic', a: 1, b: 1, optimizer: 'gd' }) },
        { label: 'Break it η=1.05', danger: true, apply: () => set({ learning_rate: 1.05, function: 'quadratic', a: 1, b: 1, optimizer: 'gd' }) },
        { label: 'Elongated valley', apply: () => set({ function: 'quadratic', a: 0.2, b: 4, learning_rate: 0.2, optimizer: 'gd' }) },
      ]} />
      {(c.optimizer === 'momentum' || c.optimizer === 'adam') && <Num label="Momentum β" value={c.momentum} onChange={(v) => set({ momentum: v })} />}
      <Num label="Iterations" value={c.iterations} step={1} onChange={(v) => set({ iterations: v })} />
      <div className="grid grid-cols-2 gap-2"><Num label="Start x" value={c.start_x} onChange={(v) => set({ start_x: v })} /><Num label="Start y" value={c.start_y} onChange={(v) => set({ start_y: v })} /></div>
    </>}>
      {r && <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Status" value={r.status} tone={r.status === 'diverged' ? '#f87171' : r.status === 'converged' ? '#2dd4bf' : '#facc15'} />
          <Stat label="Iterations" value={r.iterations_run} />
          <Stat label="Final loss" value={r.final.loss === null ? '∞' : Number(r.final.loss).toPrecision(4)} />
          <Stat label="Stable η limit" value={r.analysis.stability_limit_lr ?? '—'} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div><h4 className="mb-1 text-xs text-ink-400">Loss surface (log-shaded) and optimisation path</h4><Heatmap grid={grid} overlay={overlay} ariaLabel="Loss surface with optimisation path" /></div>
          <div className="space-y-3">
            <LineChart series={[{ name: 'loss', values: r.loss, color: '#38bdf8' }]} log={r.loss.every((v: number | null) => v === null || v > 0)} yLabel="Loss" xLabel={r.loss_stride > 1 ? `(every ${r.loss_stride})` : 'iterations'} />
            <LineChart series={[{ name: '‖∇L‖', values: r.grad_norm, color: '#a78bfa' }]} log yLabel="Gradient norm" />
          </div>
        </div>
        <Notes items={r.analysis.notes} />
      </>}
    </LabShell>
  )
}

/* ------------------------------------------------------------------ neural network */
function NeuralLab() {
  const sim = useSim('neural_network')
  const [c, setC] = useState({ dataset: 'circles', hidden: '8, 8', activation: 'tanh', init: 'xavier', optimizer: 'adam', learning_rate: 0.03, epochs: 300, batch_size: 0, l2: 0, noise: 0.1, seed: 0 })
  const set = (p: Partial<typeof c>) => setC({ ...c, ...p })
  const r = sim.res?.result
  const config = () => ({
    dataset: c.dataset, activation: c.activation, init: c.init, optimizer: c.optimizer, learning_rate: c.learning_rate,
    epochs: c.epochs, l2: c.l2, noise: c.noise, seed: c.seed, batch_size: c.batch_size > 0 ? c.batch_size : null,
    hidden_layers: c.hidden.split(',').map((s) => s.trim()).filter(Boolean).map(Number),
  })
  const overlay = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!r) return
    const [lo, hi] = r.decision_grid.extent
    const X = (x: number) => ((x - lo) / (hi - lo)) * w, Y = (y: number) => h - ((y - lo) / (hi - lo)) * h
    for (const [set, square] of [[r.points.train, false], [r.points.test, true]] as const) {
      for (const [x, y, lab] of set as number[][]) {
        ctx.fillStyle = lab > 0.5 ? '#f472b6' : '#38bdf8'
        ctx.strokeStyle = '#07090c'
        ctx.lineWidth = 1
        ctx.beginPath()
        if (square) ctx.rect(X(x) - 3.5, Y(y) - 3.5, 7, 7); else ctx.arc(X(x), Y(y), 3.2, 0, Math.PI * 2)
        ctx.fill(); ctx.stroke()
      }
    }
  }, [r])
  const h = r?.history
  const lastNorms: number[] = h?.grad_norms?.[h.grad_norms.length - 1] ?? []
  return (
    <LabShell simId="neural_network" onRun={() => sim.run(config())} {...sim} controls={<>
      <Select label="Dataset" value={c.dataset} onChange={(v) => set({ dataset: v })} options={['xor', 'circles', 'moons', 'spiral']} />
      <label className="block"><span className="mb-1 block text-[11px] font-medium text-ink-400">Hidden layers (neurons, comma-separated; empty = none)</span>
        <input className={`${inputCls} py-1.5`} value={c.hidden} onChange={(e) => set({ hidden: e.target.value })} /></label>
      <div className="grid grid-cols-2 gap-2">
        <Select label="Activation" value={c.activation} onChange={(v) => set({ activation: v })} options={['relu', 'tanh', 'sigmoid']} />
        <Select label="Initialisation" value={c.init} onChange={(v) => set({ init: v })} options={['xavier', 'he', 'zeros', 'large']} />
        <Select label="Optimiser" value={c.optimizer} onChange={(v) => set({ optimizer: v })} options={['sgd', 'momentum', 'adam']} />
        <Num label="Learning rate" value={c.learning_rate} onChange={(v) => set({ learning_rate: v })} />
        <Num label="Epochs" value={c.epochs} step={1} onChange={(v) => set({ epochs: v })} />
        <Num label="Batch (0 = full)" value={c.batch_size} step={1} onChange={(v) => set({ batch_size: v })} />
        <Num label="L2 λ" value={c.l2} onChange={(v) => set({ l2: v })} />
        <Num label="Noise" value={c.noise} onChange={(v) => set({ noise: v })} />
      </div>
      <Num label="Seed" value={c.seed} step={1} onChange={(v) => set({ seed: v })} />
      <Presets items={[
        { label: 'No hidden layer', danger: true, apply: () => set({ hidden: '' }) },
        { label: 'All-zero init', danger: true, apply: () => set({ init: 'zeros' }) },
        { label: 'Huge LR + ReLU', danger: true, apply: () => set({ activation: 'relu', optimizer: 'sgd', learning_rate: 20, init: 'large' }) },
        { label: 'Deep sigmoid', danger: true, apply: () => set({ activation: 'sigmoid', hidden: '8, 8, 8, 8, 8', optimizer: 'sgd', learning_rate: 0.5 }) },
        { label: 'Overfit spiral', danger: true, apply: () => set({ dataset: 'spiral', hidden: '64, 64', noise: 0.6, epochs: 1500 }) },
      ]} />
    </>}>
      {r && <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Status" value={r.status} tone={r.status === 'diverged' ? '#f87171' : '#2dd4bf'} />
          <Stat label="Parameters" value={r.parameters} />
          <Stat label="Train acc" value={r.final.train_acc === null ? '—' : `${(r.final.train_acc * 100).toFixed(1)}%`} />
          <Stat label="Test acc" value={r.final.test_acc === null ? '—' : `${(r.final.test_acc * 100).toFixed(1)}%`} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <h4 className="mb-1 text-xs text-ink-400">Decision boundary · ● train ■ test · blue = class 0, pink = class 1</h4>
            <Heatmap grid={(r.decision_grid.p as number[][]).slice().reverse()} diverging overlay={overlay} ariaLabel="Decision boundary" />
          </div>
          <div className="space-y-3">
            <LineChart x={h.epoch} series={[{ name: 'train loss', values: h.train_loss, color: '#38bdf8' }, { name: 'test loss', values: h.test_loss, color: '#f472b6' }]} yLabel="Loss" xLabel="epochs" />
            <LineChart x={h.epoch} series={[{ name: 'train acc', values: h.train_acc, color: '#2dd4bf' }, { name: 'test acc', values: h.test_acc, color: '#facc15' }]} yLabel="Accuracy" xLabel="epochs" />
            {lastNorms.length > 0 && (
              <div>
                <h4 className="mb-1 text-xs text-ink-400">Gradient norm per layer (latest, log scale) {r.dead_relu_fraction.some((d: number) => d > 0) && `· dead ReLU: ${r.dead_relu_fraction.map((d: number) => `${(d * 100).toFixed(0)}%`).join(' / ')}`}</h4>
                <div className="flex h-20 items-end gap-2">
                  {lastNorms.map((n, i) => {
                    const v = Math.log10(Math.max(n, 1e-8)) + 8
                    return <div key={i} className="flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-t bg-violet" style={{ height: `${Math.max(2, (v / 9) * 64)}px` }} title={n.toExponential(2)} /><span className="text-[10px] text-ink-400">L{i + 1}</span></div>
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <Notes items={r.diagnostics} title="Diagnostics" />
      </>}
    </LabShell>
  )
}

/* ------------------------------------------------------------------ machine learning */
function MLLab() {
  const sim = useSim('ml_lab')
  const [c, setC] = useState({ dataset: 'iris', model: 'logistic_regression', standardize: true, test_size: 0.25, seed: 42, max_depth: 0, n_neighbors: 5, C: 1, n_estimators: 100, label_noise: 0 })
  const set = (p: Partial<typeof c>) => setC({ ...c, ...p })
  const r = sim.res?.result
  return (
    <LabShell simId="ml_lab" onRun={() => sim.run({ ...c, max_depth: c.max_depth > 0 ? c.max_depth : null })} {...sim} controls={<>
      <Select label="Dataset" value={c.dataset} onChange={(v) => set({ dataset: v })} options={[['iris', 'Iris (3 classes)'], ['wine', 'Wine (3 classes)'], ['breast_cancer', 'Breast cancer (2 classes)']]} />
      <Select label="Model" value={c.model} onChange={(v) => set({ model: v })} options={[['logistic_regression', 'Logistic regression'], ['knn', 'k-nearest neighbours'], ['decision_tree', 'Decision tree'], ['random_forest', 'Random forest'], ['svm', 'Support vector machine']]} />
      <Toggle label="Standardise features (fit on train split only)" checked={c.standardize} onChange={(v) => set({ standardize: v })} />
      <div className="grid grid-cols-2 gap-2">
        <Num label="Test fraction" value={c.test_size} onChange={(v) => set({ test_size: v })} />
        <Num label="Seed" value={c.seed} step={1} onChange={(v) => set({ seed: v })} />
        {(c.model === 'decision_tree' || c.model === 'random_forest') && <Num label="Max depth (0 = none)" value={c.max_depth} step={1} onChange={(v) => set({ max_depth: v })} />}
        {c.model === 'random_forest' && <Num label="Trees" value={c.n_estimators} step={1} onChange={(v) => set({ n_estimators: v })} />}
        {c.model === 'knn' && <Num label="k neighbours" value={c.n_neighbors} step={1} onChange={(v) => set({ n_neighbors: v })} />}
        {(c.model === 'svm' || c.model === 'logistic_regression') && <Num label="C (inverse regularisation)" value={c.C} onChange={(v) => set({ C: v })} />}
        <Num label="Label noise" value={c.label_noise} onChange={(v) => set({ label_noise: v })} hint="fraction of training labels flipped" />
      </div>
      <Presets items={[
        { label: 'Overfit a deep tree', danger: true, apply: () => set({ dataset: 'wine', model: 'decision_tree', max_depth: 0, label_noise: 0.3 }) },
        { label: 'k-NN unscaled', danger: true, apply: () => set({ dataset: 'wine', model: 'knn', standardize: false }) },
      ]} />
    </>}>
      {r && <>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Train accuracy" value={`${(r.train_accuracy * 100).toFixed(1)}%`} />
          <Stat label="Test accuracy" value={`${(r.test_accuracy * 100).toFixed(1)}%`} />
          <Stat label="Macro F1" value={r.macro_f1.toFixed(3)} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div><h4 className="mb-2 text-xs text-ink-400">Confusion matrix (rows = actual, columns = predicted) · {r.n_test} test samples</h4>
            <MatrixTable matrix={r.confusion_matrix} rowLabels={r.classes} colLabels={r.classes} /></div>
          <div><h4 className="mb-2 text-xs text-ink-400">Per-class metrics on the test split</h4>
            <table className="w-full text-xs"><thead className="text-ink-400"><tr><th className="text-left">Class</th><th>Precision</th><th>Recall</th><th>F1</th><th>Support</th></tr></thead>
              <tbody>{r.classes.map((cl: string) => { const m = r.per_class[cl]; return <tr key={cl} className="border-t border-ink-700 text-center font-mono"><td className="py-1 text-left font-sans">{cl}</td><td>{m.precision.toFixed(3)}</td><td>{m.recall.toFixed(3)}</td><td>{m['f1-score'].toFixed(3)}</td><td>{m.support}</td></tr> })}</tbody></table>
          </div>
        </div>
        <Notes items={r.notes} />
      </>}
    </LabShell>
  )
}

/* ------------------------------------------------------------------ RAG */
function RAGLab() {
  const sim = useSim('rag')
  const [c, setC] = useState({ query: 'why does a large learning rate diverge', chunk_size: 80, overlap: 20, top_k: 5, k1: 1.5, b: 0.75, remove_stopwords: true })
  const set = (p: Partial<typeof c>) => setC({ ...c, ...p })
  const r = sim.res?.result
  const highlight = (text: string, terms: string[]) => {
    const re = new RegExp(`\\b(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')
    return terms.length ? text.split(re).map((part, i) => (i % 2 ? <mark key={i} className="rounded bg-teal/25 px-0.5 text-white">{part}</mark> : part)) : text
  }
  return (
    <LabShell simId="rag" onRun={() => sim.run({ ...c, corpus: 'curriculum', evaluate: true })} {...sim} controls={<>
      <label className="block"><span className="mb-1 block text-[11px] font-medium text-ink-400">Query</span>
        <textarea className={`${inputCls} h-20`} value={c.query} onChange={(e) => set({ query: e.target.value })} /></label>
      <div className="grid grid-cols-2 gap-2">
        <Num label="Chunk size (words)" value={c.chunk_size} step={1} onChange={(v) => set({ chunk_size: v })} />
        <Num label="Overlap (words)" value={c.overlap} step={1} onChange={(v) => set({ overlap: v })} />
        <Num label="Top k" value={c.top_k} step={1} onChange={(v) => set({ top_k: v })} />
        <Num label="BM25 k1" value={c.k1} onChange={(v) => set({ k1: v })} />
        <Num label="BM25 b" value={c.b} onChange={(v) => set({ b: v })} />
      </div>
      <Toggle label="Remove stopwords" checked={c.remove_stopwords} onChange={(v) => set({ remove_stopwords: v })} />
      <Presets items={[
        { label: 'Tiny chunks', danger: true, apply: () => set({ chunk_size: 6, overlap: 0 }) },
        { label: 'Huge chunks', danger: true, apply: () => set({ chunk_size: 500, overlap: 0 }) },
        { label: 'No length norm (b=0)', danger: true, apply: () => set({ b: 0 }) },
      ]} />
      <p className="text-[11px] text-ink-400">Lexical retrieval needs no AI model. Embedding retrieval is planned as an optional add-on.</p>
    </>}>
      {r && <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Chunks indexed" value={r.n_chunks} />
          <Stat label="Query terms" value={r.query_terms.length} />
          {r.evaluation && <Stat label={`Recall@${r.evaluation.k}`} value={r.evaluation.recall_at_k.toFixed(2)} />}
          {r.evaluation && <Stat label="MRR" value={r.evaluation.mrr.toFixed(3)} />}
        </div>
        <ol className="space-y-2">
          {r.results.map((h: R) => (
            <li key={h.chunk_index} className="rounded-xl border border-ink-700 bg-ink-800/50 p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs"><Badge>#{h.rank}</Badge><span className="text-white">{h.doc_id}</span><span className="font-mono text-ink-400">score {h.score}</span>
                <span className="text-ink-400">matched: {h.matched_terms.join(', ')}</span></div>
              <p className="text-xs leading-relaxed text-ink-200">{highlight(h.text, h.matched_terms)}</p>
            </li>
          ))}
        </ol>
        {r.evaluation && (
          <details className="rounded-xl border border-ink-700 p-3 text-xs"><summary className="cursor-pointer text-ink-200">Evaluation set - rank of the relevant lesson per query</summary>
            <table className="mt-2 w-full"><tbody>{r.evaluation.queries.map((q: R) => <tr key={q.query} className="border-t border-ink-700"><td className="py-1 pr-2 text-ink-200">{q.query}</td><td className="text-ink-400">{q.relevant}</td><td className={`text-right font-mono ${q.rank ? 'text-teal' : 'text-red-300'}`}>{q.rank ?? 'miss'}</td></tr>)}</tbody></table>
          </details>
        )}
        <Notes items={r.notes} />
      </>}
    </LabShell>
  )
}

/* ------------------------------------------------------------------ transformer */
function TransformerLab() {
  const sim = useSim('transformer')
  const [c, setC] = useState({ text: 'the model reads the whole sentence at once', d_model: 16, n_heads: 2, positional: true, causal_mask: false, seed: 0 })
  const set = (p: Partial<typeof c>) => setC({ ...c, ...p })
  const r = sim.res?.result
  return (
    <LabShell simId="transformer" onRun={() => sim.run(c)} {...sim} controls={<>
      <label className="block"><span className="mb-1 block text-[11px] font-medium text-ink-400">Input text (max 24 tokens)</span>
        <textarea className={`${inputCls} h-20`} value={c.text} onChange={(e) => set({ text: e.target.value })} /></label>
      <div className="grid grid-cols-2 gap-2">
        <Num label="d_model" value={c.d_model} step={1} onChange={(v) => set({ d_model: v })} />
        <Num label="Heads" value={c.n_heads} step={1} onChange={(v) => set({ n_heads: v })} />
        <Num label="Seed" value={c.seed} step={1} onChange={(v) => set({ seed: v })} />
      </div>
      <Toggle label="Add positional encoding" checked={c.positional} onChange={(v) => set({ positional: v })} />
      <Toggle label="Causal mask (decoder-style)" checked={c.causal_mask} onChange={(v) => set({ causal_mask: v })} />
    </>}>
      {r && <>
        <p className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-3 py-2 text-xs text-yellow-200">{r.disclaimer}</p>
        <div className="flex flex-wrap gap-1.5">{r.tokens.map((t: string, i: number) => <span key={i} className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1 font-mono text-xs"><span className="text-white">{t}</span> <span className="text-ink-400">#{r.token_ids[i]}</span></span>)}</div>
        <div className="grid gap-4 xl:grid-cols-2">
          {r.attention.map((A: number[][], hI: number) => (
            <div key={hI}><h4 className="mb-1 text-xs text-ink-400">Head {hI + 1} attention weights (row = query token attends to columns; rows sum to {r.row_sums[hI].every((s: number) => Math.abs(s - 1) < 1e-6) ? '1 ✓' : '?'})</h4>
              <MatrixTable matrix={A} rowLabels={r.tokens} colLabels={r.tokens} /></div>
          ))}
        </div>
        <Notes title="Permutation experiment" items={[`Max output difference after reversing and un-reversing the sentence: ${r.permutation_test.max_output_difference_after_unshuffling}`, r.permutation_test.explanation]} />
      </>}
    </LabShell>
  )
}

/* ------------------------------------------------------------------ infrastructure */
function InfraLab() {
  const sim = useSim('infrastructure')
  const [c, setC] = useState({ params_billion: 7, precision: 'fp16', hardware: 'consumer_gpu_24gb', batch_size: 1, context_length: 4096, n_layers: 32, hidden_size: 4096, run_benchmark: true })
  const set = (p: Partial<typeof c>) => setC({ ...c, ...p })
  const r = sim.res?.result
  const e = r?.estimate
  return (
    <LabShell simId="infrastructure" onRun={() => sim.run(c)} {...sim} controls={<>
      <div className="grid grid-cols-2 gap-2">
        <Num label="Parameters (billions)" value={c.params_billion} onChange={(v) => set({ params_billion: v })} />
        <Select label="Precision" value={c.precision} onChange={(v) => set({ precision: v })} options={['fp32', 'fp16', 'bf16', 'int8', 'int4']} />
        <Num label="Layers" value={c.n_layers} step={1} onChange={(v) => set({ n_layers: v })} />
        <Num label="Hidden size" value={c.hidden_size} step={1} onChange={(v) => set({ hidden_size: v })} />
        <Num label="Batch size" value={c.batch_size} step={1} onChange={(v) => set({ batch_size: v })} />
        <Num label="Context length" value={c.context_length} step={1} onChange={(v) => set({ context_length: v })} />
      </div>
      <Select label="Hardware preset" value={c.hardware} onChange={(v) => set({ hardware: v })} options={[['laptop_cpu', 'Laptop CPU'], ['laptop_igpu', 'Integrated GPU'], ['consumer_gpu_8gb', 'Consumer GPU 8 GB'], ['consumer_gpu_24gb', 'Consumer GPU 24 GB'], ['datacenter_80gb', 'Data-centre GPU 80 GB']]} />
      <Toggle label="Benchmark this machine's CPU" checked={c.run_benchmark} onChange={(v) => set({ run_benchmark: v })} />
      <Presets items={[{ label: '70B on 8 GB', danger: true, apply: () => set({ params_billion: 70, n_layers: 80, hidden_size: 8192, hardware: 'consumer_gpu_8gb' }) }, { label: 'Long context ×32 batch', danger: true, apply: () => set({ context_length: 32768, batch_size: 32 }) }]} />
    </>}>
      {e && <>
        <div className="rounded-xl border border-ink-700 p-3">
          <div className="mb-2 flex items-center gap-2"><Badge color="#facc15">ESTIMATE</Badge><span className="text-xs text-ink-400">Analytical model on {e.hardware} - not a measurement</span></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Total memory" value={`${e.memory_gb.total} GB`} tone={e.fits ? '#2dd4bf' : '#f87171'} />
            <Stat label="Fits device" value={e.fits ? `yes (${e.memory_gb.device_capacity} GB)` : `no (${e.memory_gb.device_capacity} GB)`} />
            <Stat label="Decode tokens/s" value={e.throughput_tokens_per_s} />
            <Stat label="First-token latency" value={`${e.time_to_first_token_ms} ms`} />
          </div>
          <p className="mt-2 text-xs text-ink-400">Weights {e.memory_gb.weights} GB · KV cache {e.memory_gb.kv_cache} GB · overhead {e.memory_gb.runtime_overhead} GB · step {e.decode_step_ms} ms ({e.bound}-bound)</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div><h4 className="mb-1 text-xs text-ink-400">Precision trade-off (estimate)</h4>
            <table className="w-full text-xs"><thead className="text-ink-400"><tr><th className="text-left">Precision</th><th>Memory</th><th>Fits</th><th>Tokens/s</th></tr></thead>
              <tbody>{Object.entries(r.precision_sweep).map(([p, v]: [string, R]) => <tr key={p} className="border-t border-ink-700 text-center font-mono"><td className="py-1 text-left">{p}</td><td>{v.total_gb} GB</td><td>{v.fits ? '✓' : '✗'}</td><td>{v.tokens_per_s}</td></tr>)}</tbody></table></div>
          <div><h4 className="mb-1 text-xs text-ink-400">Batch size trade-off (estimate)</h4>
            <table className="w-full text-xs"><thead className="text-ink-400"><tr><th className="text-left">Batch</th><th>Tokens/s</th><th>Step</th><th>Memory</th></tr></thead>
              <tbody>{Object.entries(r.batch_sweep).map(([b, v]: [string, R]) => <tr key={b} className="border-t border-ink-700 text-center font-mono"><td className="py-1 text-left">{b}</td><td>{v.tokens_per_s}</td><td>{v.step_ms} ms</td><td>{v.total_gb} GB{v.fits ? '' : ' ✗'}</td></tr>)}</tbody></table></div>
        </div>
        {r.measurement && (
          <div className="rounded-xl border border-teal/40 p-3">
            <div className="mb-2 flex items-center gap-2"><Badge>MEASURED</Badge><span className="text-xs text-ink-400">{r.measurement.device} · {r.measurement.matrix_size}×{r.measurement.matrix_size} matmul</span></div>
            <div className="grid grid-cols-2 gap-2">{Object.entries(r.measurement.results).map(([k, v]: [string, R]) => <Stat key={k} label={k} value={`${v.gflops} GFLOP/s`} />)}</div>
          </div>
        )}
        <Notes items={e.notes} />
      </>}
    </LabShell>
  )
}
