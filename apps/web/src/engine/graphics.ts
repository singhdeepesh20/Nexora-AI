export type GraphicsPreset = 'low' | 'medium' | 'high'

export interface GraphicsConfig {
  dpr: [number, number]
  shadows: boolean
  shadowMapSize: number
  antialias: boolean
  trees: number
  lampLights: boolean
  sky: boolean
}

export const GRAPHICS: Record<GraphicsPreset, GraphicsConfig> = {
  low: { dpr: [0.75, 1], shadows: false, shadowMapSize: 512, antialias: false, trees: 60, lampLights: false, sky: false },
  medium: { dpr: [1, 1.5], shadows: true, shadowMapSize: 1024, antialias: true, trees: 140, lampLights: false, sky: true },
  high: { dpr: [1, 2], shadows: true, shadowMapSize: 2048, antialias: true, trees: 240, lampLights: true, sky: true },
}

/** Rolling frame-rate monitor, written by the render loop and read by the HUD. */
export const perf = { fps: 0, frames: 0, acc: 0, lowSince: 0 }
export function sampleFrame(dt: number) {
  perf.frames++
  perf.acc += dt
  if (perf.acc >= 0.5) {
    perf.fps = Math.round(perf.frames / perf.acc)
    perf.frames = 0
    perf.acc = 0
  }
}
