/** Campus lighting phases. Purely visual - never affects lesson access. */
export type DayPhase = 'morning' | 'afternoon' | 'evening' | 'night'
export type TimeSetting = 'auto' | DayPhase

export function phaseFor(setting: TimeSetting | undefined, now = new Date()): DayPhase {
  if (setting && setting !== 'auto') return setting
  const h = now.getHours()
  return h >= 6 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'afternoon' : h >= 17 && h < 20 ? 'evening' : 'night'
}

export const LIGHTING: Record<DayPhase, { sun: [number, number, number]; sunColor: string; sunIntensity: number; hemi: number; sky: string; fog: string; lamps: number; skyShader: boolean }> = {
  morning: { sun: [60, 35, 40], sunColor: '#ffe7c4', sunIntensity: 1.8, hemi: 0.85, sky: '#bcd9ee', fog: '#cfe2ee', lamps: 0.3, skyShader: true },
  afternoon: { sun: [40, 60, 25], sunColor: '#ffffff', sunIntensity: 2.1, hemi: 0.9, sky: '#9ccbe8', fog: '#b9d8ea', lamps: 0.3, skyShader: true },
  evening: { sun: [-60, 14, 30], sunColor: '#ffb27a', sunIntensity: 1.3, hemi: 0.55, sky: '#f0a37a', fog: '#d9a98d', lamps: 1.4, skyShader: true },
  night: { sun: [-30, 40, -20], sunColor: '#b4c3ff', sunIntensity: 0.6, hemi: 0.42, sky: '#14213d', fog: '#1a2a47', lamps: 2.2, skyShader: false },
}
