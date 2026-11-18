import { useEffect, useRef } from 'react'

export interface Series { name: string; values: (number | null)[]; color: string }

/** Lightweight SVG line chart (no chart library needed, works offline). */
export function LineChart({ series, x, height = 180, log = false, yLabel, xLabel }: {
  series: Series[]; x?: number[]; height?: number; log?: boolean; yLabel?: string; xLabel?: string
}) {
  const W = 520, H = height, P = { l: 46, r: 10, t: 10, b: 26 }
  const tf = (v: number) => (log ? Math.log10(Math.max(v, 1e-12)) : v)
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null && Number.isFinite(v)).map(tf))
  if (!all.length) return <div className="grid h-24 place-items-center text-xs text-ink-400">No finite values to plot</div>
  let lo = Math.min(...all), hi = Math.max(...all)
  if (hi - lo < 1e-12) { hi += 1; lo -= 1 }
  const n = Math.max(...series.map((s) => s.values.length))
  const xs = x ?? Array.from({ length: n }, (_, i) => i)
  const x0 = xs[0] ?? 0, x1 = xs[xs.length - 1] ?? 1
  const px = (i: number) => P.l + ((xs[i] - x0) / Math.max(x1 - x0, 1e-9)) * (W - P.l - P.r)
  const py = (v: number) => P.t + (1 - (tf(v) - lo) / (hi - lo)) * (H - P.t - P.b)
  const ticks = [0, 0.5, 1].map((f) => lo + f * (hi - lo))
  const fmt = (v: number) => {
    const r = log ? 10 ** v : v
    return Math.abs(r) >= 1000 || (Math.abs(r) < 0.01 && r !== 0) ? r.toExponential(1) : r.toFixed(Math.abs(r) < 1 ? 3 : 2)
  }
  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={series.map((s) => s.name).join(', ')}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={P.t + (1 - (t - lo) / (hi - lo)) * (H - P.t - P.b)} y2={P.t + (1 - (t - lo) / (hi - lo)) * (H - P.t - P.b)} stroke="#2a3441" strokeDasharray="3 4" />
            <text x={P.l - 6} y={P.t + (1 - (t - lo) / (hi - lo)) * (H - P.t - P.b) + 4} textAnchor="end" fontSize="10" fill="#6b7a8c">{fmt(t)}</text>
          </g>
        ))}
        <text x={P.l} y={H - 6} fontSize="10" fill="#6b7a8c">{x0}</text>
        <text x={W - P.r} y={H - 6} fontSize="10" fill="#6b7a8c" textAnchor="end">{x1}{xLabel ? ` ${xLabel}` : ''}</text>
        {series.map((s) => {
          let d = ''
          s.values.forEach((v, i) => {
            if (v === null || !Number.isFinite(v)) return
            d += `${d ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`
          })
          return <path key={s.name} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
        })}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-3 text-[11px] text-ink-400">
        {yLabel && <span>{yLabel}{log ? ' (log scale)' : ''}:</span>}
        {series.map((s) => <span key={s.name} className="flex items-center gap-1"><i className="inline-block h-0.5 w-3" style={{ background: s.color }} />{s.name}</span>)}
      </figcaption>
    </figure>
  )
}

/** Colour ramp from deep blue to teal to white. */
export function ramp(t: number): [number, number, number] {
  const c = Math.max(0, Math.min(1, t))
  const stops: [number, number, number][] = [[12, 20, 40], [14, 116, 144], [45, 212, 191], [240, 253, 250]]
  const f = c * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), u = f - i
  return stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * u)) as [number, number, number]
}

/** Canvas heatmap with optional overlay drawing (paths, points). Row 0 is drawn at the top. */
export function Heatmap({ grid, width = 360, height = 360, overlay, diverging = false, ariaLabel }: {
  grid: number[][]; width?: number; height?: number; diverging?: boolean; ariaLabel: string
  overlay?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv || !grid.length) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const rows = grid.length, cols = grid[0].length
    const flat = grid.flat().filter(Number.isFinite)
    const lo = Math.min(...flat), hi = Math.max(...flat)
    const img = ctx.createImageData(cols, rows)
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const v = grid[r][c]
      const t = diverging ? v : (v - lo) / (hi - lo || 1)
      const [R, G, B] = diverging ? divergingColor(t) : ramp(t)
      const k = (r * cols + c) * 4
      img.data[k] = R; img.data[k + 1] = G; img.data[k + 2] = B; img.data[k + 3] = 255
    }
    const off = document.createElement('canvas')
    off.width = cols
    off.height = rows
    off.getContext('2d')!.putImageData(img, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.drawImage(off, 0, 0, cv.width, cv.height)
    overlay?.(ctx, cv.width, cv.height)
  }, [grid, overlay])
  return <canvas ref={ref} width={width} height={height} role="img" aria-label={ariaLabel} className="h-auto w-full max-w-[420px] rounded-lg border border-ink-700" />
}

function divergingColor(p: number): [number, number, number] {
  const a: [number, number, number] = [56, 189, 248], b: [number, number, number] = [244, 114, 182]
  const t = Math.max(0, Math.min(1, p))
  const mid: [number, number, number] = [20, 26, 34]
  const [from, to, u] = t < 0.5 ? [a, mid, t * 2] : [mid, b, (t - 0.5) * 2]
  return from.map((v, k) => Math.round(v + (to[k] - v) * u)) as [number, number, number]
}

/** Small matrix table with cell shading - used for attention and confusion matrices. */
export function MatrixTable({ matrix, rowLabels, colLabels, digits = 2 }: { matrix: number[][]; rowLabels: string[]; colLabels: string[]; digits?: number }) {
  const max = Math.max(...matrix.flat(), 1e-9)
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="border-separate border-spacing-0.5 text-[11px]">
        <thead>
          <tr><th />{colLabels.map((c, i) => <th key={i} className="px-1 py-0.5 font-normal text-ink-400">{c}</th>)}</tr>
        </thead>
        <tbody>
          {matrix.map((row, r) => (
            <tr key={r}>
              <th className="pr-2 text-right font-normal text-ink-400">{rowLabels[r]}</th>
              {row.map((v, c) => {
                const [R, G, B] = ramp(v / max)
                return <td key={c} className="min-w-9 rounded px-1.5 py-1 text-center font-mono" style={{ background: `rgb(${R},${G},${B})`, color: v / max > 0.6 ? '#07090c' : '#e6edf3' }}>{Number.isInteger(v) ? v : v.toFixed(digits)}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
