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

