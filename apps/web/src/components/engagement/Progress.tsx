import { CheckCircle2, Circle, Flame, Share2, TrendingUp } from 'lucide-react'
import { useEffect } from 'react'
import { useApp } from '../../stores/app'
import { Badge, Button, Meter, Panel, Spinner } from '../ui/primitives'

export const RANK_COLOR: Record<string, string> = {
  intern: '#94a3b8', junior: '#38bdf8', engineer: '#2dd4bf', senior: '#a78bfa', principal: '#f472b6', research: '#facc15',
}

