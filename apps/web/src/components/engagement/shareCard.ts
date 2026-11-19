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

export function drawCard(canvas: HTMLCanvasElement, card: ShareCard): void {
  const L = layoutCard(card)
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')!
  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H)
  bg.addColorStop(0, '#07090c')
  bg.addColorStop(1, '#0d1b2a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  // technical motif: a faint grid and a network graph in the corner
  ctx.strokeStyle = 'rgba(56,189,248,0.06)'
  ctx.lineWidth = 1
  for (let x = 0; x < CARD_W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CARD_H); ctx.stroke() }
  for (let y = 0; y < CARD_H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CARD_W, y); ctx.stroke() }
  const nodes = [[930, 140], [1040, 90], [1090, 210], [980, 260], [1130, 320], [1020, 360]]
  ctx.strokeStyle = `${L.accent}55`
  ctx.lineWidth = 2
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if ((i + j) % 2) {
    ctx.beginPath(); ctx.moveTo(nodes[i][0], nodes[i][1]); ctx.lineTo(nodes[j][0], nodes[j][1]); ctx.stroke()
  }
  ctx.fillStyle = L.accent
  nodes.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill() })
  ctx.fillStyle = L.accent
  ctx.fillRect(0, 0, 10, CARD_H)
  const font = (size: number, weight: number) => `${weight} ${size}px Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`
  for (const l of L.lines) {
    let size = l.size
    ctx.font = font(size, l.weight)
    while (size > 30 && ctx.measureText(l.text).width > 820) { size -= 2; ctx.font = font(size, l.weight) } // shrink long titles to fit
    ctx.fillStyle = l.color
    ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${l.spacing}px`
    ctx.fillText(fit(ctx, l.text, 820), l.x, l.y)
  }
  ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px'
  for (const s of L.stats) {
    ctx.font = font(16, 600)
    ctx.fillStyle = '#6b7a8c'
    ctx.fillText(fit(ctx, s.label.toUpperCase(), 300), s.x, s.y)
    ctx.font = font(30, 700)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(fit(ctx, s.value, 300), s.x, s.y + 36)
  }
  if (L.grid) {
    L.grid.forEach((row, r) => row.slice(0, 10).forEach((ok, c) => {
      ctx.fillStyle = ok ? '#2dd4bf' : '#f87171'
      ctx.beginPath()
      ctx.roundRect(760 + c * 40, 400 + r * 40, 30, 30, 6)
      ctx.fill()
    }))
  }
  // rank pill + footer
  ctx.font = font(18, 700)
  const pill = `${L.rank}${L.name ? ` · ${L.name}` : ''}`
  const w = Math.min(ctx.measureText(pill).width + 40, 600)
  ctx.fillStyle = `${L.accent}22`
  ctx.strokeStyle = L.accent
  ctx.beginPath(); ctx.roundRect(72, 548, w, 44, 22); ctx.fill(); ctx.stroke()
  ctx.fillStyle = L.accent
  ctx.fillText(fit(ctx, pill, w - 40), 92, 577)
  ctx.font = font(18, 800)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'right'
  ctx.fillText(L.footer, CARD_W - 72, 577)
  ctx.textAlign = 'left'
}

export function cardToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG export failed'))), 'image/png'))
}
