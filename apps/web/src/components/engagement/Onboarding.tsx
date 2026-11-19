import { Award, Play, Share2, SkipForward, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ChallengeResult } from '@nexora/shared-types'
import { prefersReducedMotion } from '../../engine/simEvents'
import { api } from '../../services/api'
import { useApp } from '../../stores/app'
import { LineChart } from '../ui/charts'
import { Button, ErrorNote } from '../ui/primitives'
import { EventBanner } from './EventBanner'

const ID = 'onboarding.first_experiment'
const INITIAL_LR = 20
type Step = 'welcome' | 'experiment' | 'done'

const LINES = {
  welcome: "Welcome to NEXORA. Here, you don't just study intelligent systems. You build them, test them, and sometimes break them. Let's begin.",
  intro: 'This neural network should learn XOR - but someone configured it badly. Press Train and watch the Experiment Machine behind you.',
  failed: "Interesting. You didn't break the network. You exposed a problem in the optimization process. Look at the loss: it rises instead of falling. Try a smaller learning rate.",
  stillFailing: 'Closer? Check the loss curve again. Every step is still overshooting - the learning rate is the only thing you need to change.',
  passed: 'Now you understand something important. An algorithm can be mathematically correct and still fail because of its configuration.',
}

/** Learning-rate slider on a log scale: 0.01 ... 20. */
const toLr = (v: number) => Number((10 ** (-2 + (v / 100) * Math.log10(2000))).toPrecision(2))
const fromLr = (lr: number) => ((Math.log10(lr) + 2) / Math.log10(2000)) * 100

