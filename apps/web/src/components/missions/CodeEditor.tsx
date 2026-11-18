/**
 * Monaco editor bundled locally (no CDN), so coding works offline.
 * Lazily imported - the 3D campus does not pay for it until a coding screen opens.
 */
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

;(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = { getWorker: () => new EditorWorker() }
loader.config({ monaco })

export default function CodeEditor({ value, onChange, height = '100%', readOnly = false }: {
  value: string; onChange?: (v: string) => void; height?: string | number; readOnly?: boolean
}) {
  return (
    <Editor
      height={height}
      language="python"
      theme="vs-dark"
      value={value}
      onChange={(v) => onChange?.(v ?? '')}
      options={{
        readOnly, minimap: { enabled: false }, fontSize: 13, tabSize: 4, insertSpaces: true,
        scrollBeyondLastLine: false, automaticLayout: true, renderWhitespace: 'selection', padding: { top: 10 },
      }}
    />
  )
}
