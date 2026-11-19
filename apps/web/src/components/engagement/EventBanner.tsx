import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react'
import type { SimEvent } from '@nexora/shared-types'

const STYLE = {
  critical: { icon: OctagonAlert, label: 'Critical', cls: 'border-red-400/50 bg-red-500/10 text-red-200' },
  warning: { icon: AlertTriangle, label: 'Warning', cls: 'border-yellow-400/40 bg-yellow-400/10 text-yellow-100' },
  success: { icon: CheckCircle2, label: 'Success', cls: 'border-teal/40 bg-teal/10 text-teal' },
  info: { icon: Info, label: 'Info', cls: 'border-sky/40 bg-sky/10 text-sky' },
} as const

/** Text + icon + colour, so status never depends on colour alone. */
export function EventBanner({ events }: { events: SimEvent[] }) {
  if (!events.length) return null
  return (
    <ul className="space-y-1.5" role="status" aria-live="polite" aria-label="Experiment events">
      {events.map((e, i) => {
        const st = STYLE[e.severity]
        return (
          <li key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${st.cls}`}>
            <st.icon size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span><b className="mr-1 uppercase tracking-wide">{st.label}:</b><b>{e.title}.</b> <span className="text-ink-200">{e.message}</span></span>
          </li>
        )
      })}
    </ul>
  )
}
