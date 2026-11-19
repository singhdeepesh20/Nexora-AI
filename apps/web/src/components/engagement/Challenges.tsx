import { CheckCircle2, Circle, Lightbulb, Lock, Play, Share2, Swords, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ChallengeResult, ChallengeSummary } from '@nexora/shared-types'
import { useAsync } from '../../hooks/useAsync'
import { api } from '../../services/api'
import { useApp } from '../../stores/app'
import { Num, Select, Toggle } from '../simulations/controls'
import { Badge, Button, ErrorNote, Panel, Spinner, inputCls } from '../ui/primitives'
import { EventBanner } from './EventBanner'

export const LAB_NAMES: Record<string, string> = {
  gradient_descent: 'Gradient Descent Lab', neural_network: 'Neural Network Lab', ml_lab: 'Machine Learning Lab',
  rag: 'RAG Retrieval Lab', infrastructure: 'AI Infrastructure Lab', transformer: 'Transformer Lab',
}
const DIFF_COLOR = { easy: '#2dd4bf', medium: '#facc15', hard: '#f472b6' } as const

