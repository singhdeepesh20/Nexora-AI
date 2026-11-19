/**
 * Standalone share-card renderer (Canvas 2D, offline). Draws ONLY the verified data returned by
 * /share-card - never a screenshot of the app, never private data.
 */
import type { ShareCard } from '@nexora/shared-types'

export const CARD_W = 1200
export const CARD_H = 630
const ACCENT: Record<ShareCard['layout'], string> = {
  mission: '#2dd4bf', challenge: '#f472b6', onboarding: '#38bdf8', daily: '#facc15', rank: '#a78bfa',
}
const ICON: Record<ShareCard['layout'], string> = { mission: '🧠', challenge: '💥', onboarding: '🧪', daily: '🐞', rank: '🎓' }

/** Pure layout (testable without a canvas): which text goes where. */
export function layoutCard(card: ShareCard) {
  const stats = card.stats.slice(0, 4)
  return {
    accent: ACCENT[card.layout], icon: ICON[card.layout],
    lines: [
      { text: 'NEXORA', x: 72, y: 92, size: 34, weight: 800, color: '#ffffff', spacing: 10 },
      { text: 'THE OPEN-WORLD UNIVERSITY FOR AI ENGINEERS', x: 72, y: 124, size: 16, weight: 600, color: '#6b7a8c', spacing: 3 },
      { text: card.eyebrow, x: 72, y: 210, size: 20, weight: 700, color: ACCENT[card.layout], spacing: 4 },
      { text: `${ICON[card.layout]}  ${card.title}`, x: 72, y: 272, size: 52, weight: 800, color: '#ffffff', spacing: 0 },
      { text: card.headline, x: 72, y: 322, size: 24, weight: 500, color: '#c6d0db', spacing: 0 },
    ],
    stats: stats.map((s, i) => ({ ...s, x: 72 + (i % 2) * 330, y: 400 + Math.floor(i / 2) * 70 })),
    grid: card.grid?.slice(0, 6) ?? null,
    rank: card.rank, name: card.name, footer: card.footer,
  }
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

