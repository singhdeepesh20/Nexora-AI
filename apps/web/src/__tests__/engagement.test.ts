import { describe, expect, it, vi } from 'vitest'
import type { ChallengeSummary, LearningState, ShareCard, SimEvent } from '@nexora/shared-types'
import { emitSimEvents, listenerCount, machineState, prefersReducedMotion, resetSimEvents, stateFor, subscribeSimEvents } from '../engine/simEvents'
import { layoutCard } from '../components/engagement/shareCard'
import { professorLines } from '../components/engagement/ProfessorDialog'
import { localDate } from '../components/engagement/Daily'

const ev = (type: SimEvent['type'], severity: SimEvent['severity']): SimEvent => ({ type, severity, title: type, message: '', metrics: {} })

