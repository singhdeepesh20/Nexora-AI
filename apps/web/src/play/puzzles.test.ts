import { describe, expect, it } from 'vitest'
import { EMOJI, judge, PUZZLES, puzzleFor, puzzleNumber, shareText } from './puzzles'
import { train } from './sim'

const FIX: Record<string, object> = {
  exploding: { learningRate: 0.3 }, frozen: { learningRate: 0.5 }, flatland: { hidden: 6 }, twins: { init: 'xavier' },
  impatient: { epochs: 300 }, relu_blowup: { learningRate: 0.3 }, double: { hidden: 8, learningRate: 0.3 },
}

describe('in-browser simulation', () => {
  it('is deterministic', () => {
    expect(train(PUZZLES[0].config)).toEqual(train(PUZZLES[0].config))
  })
  it('really diverges with a huge learning rate', () => {
    const r = train(PUZZLES[0].config)
    expect(Math.max(...r.losses)).toBeGreaterThan(3 * r.losses[0])
  })
})

describe('Break of the Day', () => {
  it.each(PUZZLES.map((p) => p.id))('%s starts broken and has a fix', (id) => {
    const p = PUZZLES.find((x) => x.id === id)!
    expect(judge(train(p.config))).not.toBe('solved')
    expect(judge(train({ ...p.config, ...FIX[id] }))).toBe('solved')
  })
  it('every puzzle has a tested fix', () => { expect(Object.keys(FIX).sort()).toEqual(PUZZLES.map((p) => p.id).sort()) })
  it('same date, same puzzle', () => {
    expect(puzzleNumber(new Date(2026, 0, 1, 23))).toBe(1)
    expect(puzzleNumber(new Date(2026, 10, 19, 1))).toBe(323)
    expect(puzzleFor(323)).toBe(puzzleFor(323 + PUZZLES.length))
  })
  it('share text encodes real outcomes', () => {
    const t = shareText(323, ['diverged', 'failed', 'solved'], 'https://x.test/play')
    expect(t).toContain(`${EMOJI.diverged}${EMOJI.failed}${EMOJI.solved} 3/6`)
    expect(t).toContain('#323')
    expect(shareText(5, ['failed'], 'u')).toContain('X/6')
  })
})
