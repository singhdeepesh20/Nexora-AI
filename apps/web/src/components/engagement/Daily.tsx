import { Bug, CheckCircle2, Play, Share2, Timer } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import type { DailyView } from '@nexora/shared-types'
import { api } from '../../services/api'
import { useApp } from '../../stores/app'
import { Markdown } from '../ui/Markdown'
import { Badge, Button, ErrorNote, Panel, Spinner } from '../ui/primitives'

const CodeEditor = lazy(() => import('../missions/CodeEditor'))

/** Local calendar date (YYYY-MM-DD) in the student's own time zone. */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

