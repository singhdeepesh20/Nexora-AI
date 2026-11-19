import { Clipboard, Download, Share2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ShareCard } from '@nexora/shared-types'
import { api } from '../../services/api'
import { useApp } from '../../stores/app'
import { Button, ErrorNote, Panel, Spinner } from '../ui/primitives'
import { cardToBlob, drawCard } from './shareCard'

/** Preview-before-export. Nothing is uploaded; the student decides what leaves the device. */
export function ShareDialog({ card, refId, text }: { card: 'mission' | 'challenge' | 'daily' | 'rank'; refId?: string; text?: string }) {
  const { student, toast } = useApp()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [data, setData] = useState<ShareCard | null>(null)
  const [withName, setWithName] = useState(false)
  const [error, setError] = useState<unknown>(null)
  useEffect(() => {
    const q = new URLSearchParams({ kind: card, ref: refId ?? '', include_name: String(withName), tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
    api.get<ShareCard>(`/students/${student!.id}/share-card?${q}`).then(setData, setError)
  }, [card, refId, withName, student])
  useEffect(() => { if (data && canvas.current) drawCard(canvas.current, data) }, [data])

  const fileName = `nexora-${card}${refId ? `-${refId.replace(/[^a-z0-9]+/gi, '-')}` : ''}.png`
  const download = async () => {
    const blob = await cardToBlob(canvas.current!)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }
  const copyImage = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': cardToBlob(canvas.current!) })])
      toast('Card image copied to the clipboard', 'success')
    } catch { toast('This browser cannot copy images - use Download instead', 'error') }
  }
  const nativeShare = async () => {
    const file = new File([await cardToBlob(canvas.current!)], fileName, { type: 'image/png' })
    try { await navigator.share({ files: [file], text: text ?? 'Learn AI by engineering AI - NEXORA' }) } catch { /* cancelled */ }
  }
  const canShareFiles = typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [new File([], 'x.png', { type: 'image/png' })] })
  return (
    <Panel title="Share your achievement" subtitle="Preview first - nothing is uploaded unless you share it yourself" accent="#38bdf8" wide>
      <div className="space-y-4 p-5">
        <ErrorNote error={error} />
        {!data && !error && <Spinner label="Preparing card" />}
        <canvas ref={canvas} className={`h-auto w-full max-w-3xl rounded-xl border border-ink-700 ${data ? '' : 'hidden'}`}
          role="img" aria-label={data ? `${data.eyebrow}: ${data.title}. ${data.stats.map((s) => `${s.label} ${s.value}`).join(', ')}` : 'Share card'} />
        {data && (
          <>
            <label className="flex items-center gap-2 text-sm text-ink-200">
              <input type="checkbox" className="accent-teal-400" checked={withName} onChange={(e) => setWithName(e.target.checked)} />
              Include my display name on the card
            </label>
            <p className="text-[11px] text-ink-400">Contains only verified results{withName ? ' and your display name' : ''}. Never includes code, files, conversations or email.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void download()}><Download size={15} /> Download PNG</Button>
              <Button tone="ghost" onClick={() => void copyImage()}><Clipboard size={15} /> Copy image</Button>
              {canShareFiles && <Button tone="ghost" onClick={() => void nativeShare()}><Share2 size={15} /> Share…</Button>}
              {text && <Button tone="ghost" onClick={() => { void navigator.clipboard.writeText(text); toast('Result text copied', 'success') }}><Clipboard size={15} /> Copy result text</Button>}
            </div>
            {text && <pre className="w-fit rounded-lg border border-ink-700 bg-ink-950 p-3 font-mono text-xs text-ink-200">{text}</pre>}
          </>
        )}
      </div>
    </Panel>
  )
}
