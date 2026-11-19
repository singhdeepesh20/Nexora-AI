import { create } from 'zustand'
import type {
  Achievement, ConceptSummary, Progression, SimEvent, XPAward, LearningState, Student, StudentSettings, SystemInfo, WorldResponse,
} from '@nexora/shared-types'
import { api } from '../services/api'
import { emitSimEvents } from '../engine/simEvents'

export type Overlay =
  | { kind: 'district'; id: string }
  | { kind: 'gate'; id: string }
  | { kind: 'lesson'; conceptId: string }
  | { kind: 'assessment'; conceptId: string }
  | { kind: 'lab'; simId: string }
  | { kind: 'mission'; missionId: string }
  | { kind: 'missions' }
  | { kind: 'mentor'; mentorId: string; prompt?: string }
  | { kind: 'dashboard' }
  | { kind: 'map' }
  | { kind: 'settings' }
  | { kind: 'projects' }
  | { kind: 'pause' }
  | { kind: 'onboarding' }
  | { kind: 'challenges'; lab?: string }
  | { kind: 'challenge'; id: string }
  | { kind: 'share'; card: 'mission' | 'challenge' | 'daily' | 'rank'; ref?: string; text?: string }
  | { kind: 'progress' }
  | { kind: 'daily' }
  | { kind: 'professor'; id: string }

export interface Toast { id: number; text: string; tone: 'info' | 'success' | 'error' }

interface AppState {
  ready: boolean
  bootError: string | null
  students: Student[]
  student: Student | null
  world: WorldResponse | null
  concepts: Record<string, ConceptSummary>
  learning: LearningState | null
  system: SystemInfo | null
  progression: Progression | null
  overlays: Overlay[]
  toasts: Toast[]
  boot: () => Promise<void>
  selectStudent: (s: Student) => Promise<void>
  createStudent: (name: string, body: string, accent: string) => Promise<void>
  leaveCampus: () => void
  refreshLearning: () => Promise<void>
  refreshProgression: () => Promise<void>
  /** Apply a verified result: emit its events to the world, toast XP/achievements, refresh state. */
  applyResult: (r: { events?: SimEvent[]; xp?: (XPAward | null)[]; achievements?: Achievement[] }) => Promise<void>
  updateSettings: (patch: StudentSettings) => Promise<void>
  open: (o: Overlay) => void
  replace: (o: Overlay) => void
  back: () => void
  closeAll: () => void
  toast: (text: string, tone?: Toast['tone']) => void
  celebrate: (a: Achievement[] | undefined) => void
}

let toastId = 0
const LAST_STUDENT = 'nexora.lastStudent'

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  bootError: null,
  students: [],
  student: null,
  world: null,
  concepts: {},
  learning: null,
  system: null,
  overlays: [],
  toasts: [],

  boot: async () => {
    try {
      const [students, world, concepts, system] = await Promise.all([
        api.get<Student[]>('/students'),
        api.get<WorldResponse>('/world'),
        api.get<ConceptSummary[]>('/curriculum/concepts'),
        api.get<SystemInfo>('/system'),
      ])
      set({ students, world, system, concepts: Object.fromEntries(concepts.map((c) => [c.id, c])), ready: true })
    } catch (e) {
      set({ bootError: e instanceof Error ? e.message : String(e) })
    }
  },

  selectStudent: async (s) => {
    try { localStorage.setItem(LAST_STUDENT, s.id) } catch { /* storage unavailable */ }
    const fresh = await api.get<Student>(`/students/${s.id}`)
    set({ student: fresh, overlays: [] })
    await get().refreshLearning()
  },

  createStudent: async (name, body, accent) => {
    const s = await api.post<Student>('/students', { display_name: name, body_color: body, accent_color: accent })
    set({ students: [...get().students, s] })
    await get().selectStudent(s)
    get().toast(`Welcome to NEXORA, ${s.display_name}! Walk to a glowing door and press E.`, 'success')
  },

  leaveCampus: () => {
    set({ student: null, learning: null, overlays: [] })
    void api.get<Student[]>('/students').then((students) => set({ students }))
  },

  refreshLearning: async () => {
    const s = get().student
    if (!s) return
    set({ learning: await api.get<LearningState>(`/students/${s.id}/learning`) })
  },

  updateSettings: async (patch) => {
    const s = get().student
    if (!s) return
    const settings = await api.patch<StudentSettings>(`/students/${s.id}/settings`, patch)
    set({ student: { ...s, settings } })
  },

  open: (o) => set({ overlays: [...get().overlays, o] }),
  replace: (o) => set({ overlays: [...get().overlays.slice(0, -1), o] }),
  back: () => set({ overlays: get().overlays.slice(0, -1) }),
  closeAll: () => set({ overlays: [] }),

  toast: (text, tone = 'info') => {
    const id = ++toastId
    set({ toasts: [...get().toasts, { id, text, tone }] })
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 5000)
  },
  celebrate: (a) => a?.forEach((x) => get().toast(`Achievement unlocked: ${x.title}`, 'success')),
}))

export function lastStudentId(): string | null {
  try { return localStorage.getItem(LAST_STUDENT) } catch { return null }
}
