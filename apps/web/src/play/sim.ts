/**
 * In-browser simulations for the no-install /play experience. Real computation, deterministic for a
 * seed - a TypeScript port of the backend's NumPy MLP (tanh/relu hidden, sigmoid output, mean BCE).
 */
import { seededRandom } from '@nexora/world-engine'

export type Dataset = 'xor' | 'circles' | 'moons'
export interface NetConfig {
  dataset: Dataset; samples: number; noise: number; hidden: number; activation: 'tanh' | 'relu'
  init: 'xavier' | 'zeros'; optimizer: 'sgd' | 'momentum'; learningRate: number; epochs: number; seed: number
}
export interface NetResult {
  losses: number[]; trainAcc: number; testAcc: number; diverged: boolean; grid: number[][]
  points: { x: number; y: number; label: number; test: boolean }[]; status: 'diverged' | 'stalled' | 'learning' | 'converged'
}

function gaussian(r: () => number) {
  const u = Math.max(r(), 1e-12), v = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function makeData(name: Dataset, n: number, noise: number, seed: number) {
  const r = seededRandom(seed)
  const X: number[][] = [], y: number[] = []
  for (let i = 0; i < n; i++) {
    let a: number, b: number, lab: number
    if (name === 'xor') { a = r() * 2 - 1; b = r() * 2 - 1; lab = (a > 0) !== (b > 0) ? 1 : 0 }
    else if (name === 'circles') { const rad = i % 2 ? 1 : 0.4, t = r() * Math.PI * 2; a = rad * Math.cos(t); b = rad * Math.sin(t); lab = i % 2 ? 0 : 1 }
    else { const t = r() * Math.PI; lab = i % 2; a = lab ? 1 - Math.cos(t) - 0.5 : Math.cos(t) - 0.5; b = lab ? 0.25 - Math.sin(t) : Math.sin(t) - 0.25 }
    X.push([a + gaussian(r) * noise * 0.3, b + gaussian(r) * noise * 0.3]); y.push(lab)
  }
  return { X, y }
}

const sigmoid = (z: number) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)))

export function train(cfg: NetConfig): NetResult {
  const r = seededRandom(cfg.seed)
  const { X, y } = makeData(cfg.dataset, cfg.samples, cfg.noise, cfg.seed + 101)
  const nTest = Math.floor(X.length / 4)
  const tr = X.slice(nTest), ytr = y.slice(nTest), te = X.slice(0, nTest), yte = y.slice(0, nTest)
  const H = cfg.hidden
  const act = cfg.activation === 'tanh' ? Math.tanh : (z: number) => Math.max(0, z)
  const dact = cfg.activation === 'tanh' ? (_z: number, a: number) => 1 - a * a : (z: number) => (z > 0 ? 1 : 0)
  const std = (fanIn: number) => (cfg.init === 'zeros' ? 0 : Math.sqrt(1 / fanIn))
  // Parameters. With H = 0 the model is logistic regression.
  const W1 = Array.from({ length: 2 }, () => Array.from({ length: H }, () => gaussian(r) * std(2)))
  const b1 = new Array(H).fill(0)
  const nIn = H || 2
  const W2 = Array.from({ length: nIn }, () => gaussian(r) * std(nIn))
  let b2 = 0
  const vW1 = W1.map((row) => row.map(() => 0)), vb1 = b1.map(() => 0), vW2 = W2.map(() => 0)
  let vb2 = 0
  const mom = cfg.optimizer === 'momentum' ? 0.9 : 0
  const forward = (x: number[]) => {
    const z1 = H ? Array.from({ length: H }, (_, j) => x[0] * W1[0][j] + x[1] * W1[1][j] + b1[j]) : []
    const h = H ? z1.map(act) : x
    let z2 = b2
    for (let k = 0; k < nIn; k++) z2 += h[k] * W2[k]
    return { z1, h, p: sigmoid(z2) }
  }
  const bce = (data: number[][], lab: number[]) => {
    let s = 0
    data.forEach((x, i) => { const p = Math.min(Math.max(forward(x).p, 1e-12), 1 - 1e-12); s -= lab[i] * Math.log(p) + (1 - lab[i]) * Math.log(1 - p) })
    return s / data.length
  }
  const acc = (data: number[][], lab: number[]) => data.reduce((a, x, i) => a + ((forward(x).p >= 0.5 ? 1 : 0) === lab[i] ? 1 : 0), 0) / data.length
  const losses: number[] = [bce(tr, ytr)]
  let diverged = false
  for (let ep = 0; ep < cfg.epochs; ep++) {
    const gW1 = W1.map((row) => row.map(() => 0)), gb1 = b1.map(() => 0), gW2 = W2.map(() => 0)
    let gb2 = 0
    for (let i = 0; i < tr.length; i++) {
      const { z1, h, p } = forward(tr[i])
      const dz2 = (p - ytr[i]) / tr.length
      gb2 += dz2
      for (let k = 0; k < nIn; k++) gW2[k] += h[k] * dz2
      for (let j = 0; j < H; j++) {
        const dz1 = dz2 * W2[j] * dact(z1[j], h[j])
        gW1[0][j] += tr[i][0] * dz1; gW1[1][j] += tr[i][1] * dz1; gb1[j] += dz1
      }
    }
    const lr = cfg.learningRate
    for (let j = 0; j < H; j++) {
      for (const a of [0, 1]) { vW1[a][j] = mom * vW1[a][j] + gW1[a][j]; W1[a][j] -= lr * vW1[a][j] }
      vb1[j] = mom * vb1[j] + gb1[j]; b1[j] -= lr * vb1[j]
    }
    for (let k = 0; k < nIn; k++) { vW2[k] = mom * vW2[k] + gW2[k]; W2[k] -= lr * vW2[k] }
    vb2 = mom * vb2 + gb2; b2 -= lr * vb2
    const L = bce(tr, ytr)
    if (!Number.isFinite(L)) { diverged = true; break }
    losses.push(L)
  }
  const first = losses[0], peak = Math.max(...losses), last = losses[losses.length - 1]
  if (peak > 3 * first || last > 2 * first) diverged = true
  const trainAcc = acc(tr, ytr), testAcc = acc(te, yte)
  const status = diverged ? 'diverged' : Math.abs(first - last) < 0.02 * first ? 'stalled' : trainAcc >= 0.9 ? 'converged' : 'learning'
  const grid = Array.from({ length: 28 }, (_, row) => Array.from({ length: 28 }, (_, col) => {
    const p = forward([-1.6 + (col / 27) * 3.2, 1.6 - (row / 27) * 3.2]).p
    return Number.isFinite(p) ? p : 0.5
  }))
  const points = [...tr.map((p, i) => ({ x: p[0], y: p[1], label: ytr[i], test: false })), ...te.map((p, i) => ({ x: p[0], y: p[1], label: yte[i], test: true }))]
  return { losses, trainAcc, testAcc, diverged, grid, points, status }
}
