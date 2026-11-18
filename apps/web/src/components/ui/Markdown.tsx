import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo } from 'react'

/** Renders trusted curriculum Markdown; still sanitised as defence in depth (mentor replies use it too). */
export function Markdown({ source, className = '' }: { source: string; className?: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(source, { async: false, gfm: true }) as string), [source])
  return <div className={`prose-nx ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}
