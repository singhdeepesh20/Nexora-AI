import { Clipboard, Download, Share2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ShareCard } from '@nexora/shared-types'
import { api } from '../../services/api'
import { useApp } from '../../stores/app'
import { Button, ErrorNote, Panel, Spinner } from '../ui/primitives'
import { cardToBlob, drawCard } from './shareCard'

