/** "Break of the Day": one broken neural network per day, the same for everyone on that date. */
import type { NetConfig, NetResult } from './sim'

export interface Control {
  key: 'learningRate' | 'hidden' | 'init' | 'epochs' | 'activation'
  label: string; kind: 'log' | 'int' | 'choice'; min?: number; max?: number; options?: string[]
}
export interface Puzzle {
  id: string; title: string; story: string; config: NetConfig; controls: Control[]; hint: string; explanation: string
}

const BASE: NetConfig = { dataset: 'xor', samples: 160, noise: 0.05, hidden: 8, activation: 'tanh', init: 'xavier', optimizer: 'momentum', learningRate: 0.3, epochs: 150, seed: 1 }
const LR: Control = { key: 'learningRate', label: 'Learning rate', kind: 'log', min: 0.0001, max: 20 }

export const PUZZLES: Puzzle[] = [
  { id: 'exploding', title: 'The exploding network', story: 'This network should learn XOR. Instead its loss explodes. Fix it.',
    config: { ...BASE, learningRate: 20 }, controls: [LR], hint: 'Every update overshoots. Try a much smaller step.',
    explanation: 'With learning rate 20 each update jumps past the minimum and the loss explodes. A rate around 0.1-3 follows the slope down.' },
  { id: 'frozen', title: 'The frozen network', story: 'Training runs, but nothing happens. The loss is stuck.',
    config: { ...BASE, learningRate: 0.0005 }, controls: [LR], hint: 'The steps are microscopic.',
    explanation: 'A learning rate of 0.0005 moves the weights so little that 150 epochs change almost nothing. Bigger steps let it learn.' },
  { id: 'flatland', title: 'Flatland', story: 'Two rings of points. The model can only draw straight lines. Why?',
    config: { ...BASE, dataset: 'circles', hidden: 0 }, controls: [{ key: 'hidden', label: 'Hidden neurons', kind: 'int', min: 0, max: 16 }],
    hint: 'Zero hidden neurons = logistic regression.', explanation: 'Without a hidden layer the decision boundary is a straight line. A ring needs a curved boundary, which hidden neurons provide.' },
  { id: 'twins', title: 'The identical twins', story: 'Eight neurons, yet the network behaves like one. Something in how it starts...',
    config: { ...BASE, init: 'zeros' }, controls: [{ key: 'init', label: 'Weight initialisation', kind: 'choice', options: ['zeros', 'xavier'] }],
    hint: 'If every neuron starts identical, do they ever become different?', explanation: 'All-zero weights give every neuron the same gradient forever (symmetry). Random initialisation breaks the tie.' },
  { id: 'impatient', title: 'The impatient trainer', story: 'The architecture is fine. The learning rate is fine. Results are not.',
    config: { ...BASE, epochs: 5 }, controls: [{ key: 'epochs', label: 'Epochs', kind: 'int', min: 5, max: 300 }],
    hint: 'How long did it actually train?', explanation: 'Five epochs is not enough time to learn XOR. Training longer lets gradient descent finish the job.' },
  { id: 'relu_blowup', title: 'The ReLU meltdown', story: 'Two moons, a ReLU network, and chaos in the loss curve.',
    config: { ...BASE, dataset: 'moons', activation: 'relu', learningRate: 20 }, controls: [LR, { key: 'activation', label: 'Activation', kind: 'choice', options: ['relu', 'tanh'] }],
    hint: 'The activation is not the main problem.', explanation: 'Huge steps make ReLU units jump around or die. With a sane learning rate either activation solves the moons.' },
  { id: 'double', title: 'Double trouble', story: 'Two bugs at once. Rings again - and the optimiser is crawling.',
    config: { ...BASE, dataset: 'circles', hidden: 0, learningRate: 0.0005 }, controls: [{ key: 'hidden', label: 'Hidden neurons', kind: 'int', min: 0, max: 16 }, LR],
    hint: 'Fix the capacity and the step size.', explanation: 'The model needed both a hidden layer (to bend its boundary) and a learning rate large enough to train it.' },
]

export const MAX_ATTEMPTS = 6
export const EPOCH = new Date(2026, 0, 1)

/** Same local date -> same puzzle for everyone. Puzzle #1 is 1 January 2026. */
export function puzzleNumber(d = new Date()): number {
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()), b = Date.UTC(EPOCH.getFullYear(), EPOCH.getMonth(), EPOCH.getDate())
  return Math.floor((a - b) / 86400000) + 1
}
export function puzzleFor(n: number): Puzzle { return PUZZLES[(((n - 1) % PUZZLES.length) + PUZZLES.length) % PUZZLES.length] }

export type Outcome = 'solved' | 'diverged' | 'failed'
export function judge(r: NetResult): Outcome {
  if (r.diverged) return 'diverged'
  return r.trainAcc >= 0.9 && r.testAcc >= 0.85 ? 'solved' : 'failed'
}
export const EMOJI: Record<Outcome, string> = { solved: '🟩', diverged: '🟥', failed: '🟨' }

export function shareText(n: number, outcomes: Outcome[], url: string): string {
  const solved = outcomes.at(-1) === 'solved'
  return `NEXORA Break of the Day #${n}\n${outcomes.map((o) => EMOJI[o]).join('')} ${solved ? outcomes.length : 'X'}/${MAX_ATTEMPTS}\n` +
    `I fixed a broken neural network${solved ? '' : ' (almost)'}. Can you?\n${url}`
}
