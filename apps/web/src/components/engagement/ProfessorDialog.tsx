import { MessageCircle, Play, Swords } from 'lucide-react'
import type { ChallengeSummary, LearningState, Progression } from '@nexora/shared-types'
import { useAsync } from '../../hooks/useAsync'
import { api } from '../../services/api'
import { useApp } from '../../stores/app'
import { NPCS } from '../world/Characters'
import { Button, Panel, Spinner } from '../ui/primitives'

const DISTRICT: Record<string, string> = { atlas: 'foundation', newton: 'machine_learning', neural: 'deep_learning' }
const LABS: Record<string, string[]> = {
  atlas: ['infrastructure'], newton: ['gradient_descent', 'ml_lab'], neural: ['neural_network', 'rag'], nova: [],
}

