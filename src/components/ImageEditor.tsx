import { Crop, EyeOff, Loader2, MoveUpRight, Pencil, Square, Type, Undo2, X } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { fetchImageBlob } from './NoteImage'

type Tool = 'arrow' | 'rect' | 'pen' | 'text' | 'redact' | 'crop'
type Box = { x1: number; y1: number; x2: number; y2: number }
type Shape =
  | ({ t: 'arrow' | 'rect' | 'redact'; color: string; w: number } & Box)
  | { t: 'pen'; pts: [number, number][]; color: string; w: number }
  | { t: 'text'; x: number; y: number; text: string; color: string; size: number }
type Snapshot = { shapes: Shape[]; crop: Box | null }

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ffffff', '#111111']
const TOOLS: [Tool, string, typeof Crop][] = [
  ['arrow', 'Arrow', MoveUpRight], ['rect', 'Box', Square], ['pen', 'Pen', Pencil],
  ['text', 'Text', Type], ['redact', 'Redact (hide secrets)', EyeOff], ['crop', 'Crop', Crop],
]

const norm = (b: Box) => ({ x: Math.min(b.x1, b.x2), y: Math.min(b.y1, b.y2), w: Math.abs(b.x2 - b.x1), h: Math.abs(b.y2 - b.y1) })

function paint(ctx: CanvasRenderingContext2D, s: Shape) {
  ctx.save()
  ctx.strokeStyle = ctx.fillStyle = s.color
  ctx.lineCap = ctx.lineJoin = 'round'
  if (s.t === 'text') {
    ctx.font = `bold ${s.size}px ui-sans-serif, system-ui, sans-serif`
    ctx.textBaseline = 'top'
    ctx.lineWidth = Math.max(2, s.size / 6)
    ctx.strokeStyle = s.color === '#111111' ? '#ffffff' : '#111111' // outline keeps text readable on any background
    s.text.split('\n').forEach((line, i) => {
      ctx.strokeText(line, s.x, s.y + i * s.size * 1.2)
      ctx.fillText(line, s.x, s.y + i * s.size * 1.2)
    })
  } else if (s.t === 'pen') {
    ctx.lineWidth = s.w
    ctx.beginPath()
    s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.stroke()
  } else if (s.t === 'redact') {
    const r = norm(s)
    ctx.fillStyle = '#111111'
    ctx.fillRect(r.x, r.y, r.w, r.h)
  } else if (s.t === 'rect') {
    const r = norm(s)
    ctx.lineWidth = s.w
    ctx.strokeRect(r.x, r.y, r.w, r.h)
  } else {
    const a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1), head = Math.max(12, s.w * 4)
    ctx.lineWidth = s.w
    ctx.beginPath()
    ctx.moveTo(s.x1, s.y1)
    ctx.lineTo(s.x2 - Math.cos(a) * head * 0.8, s.y2 - Math.sin(a) * head * 0.8)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(s.x2, s.y2)
    ctx.lineTo(s.x2 - head * Math.cos(a - 0.45), s.y2 - head * Math.sin(a - 0.45))
    ctx.lineTo(s.x2 - head * Math.cos(a + 0.45), s.y2 - head * Math.sin(a + 0.45))
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

type Props = { fileId: string; onSave: (file: File) => Promise<void>; onClose: () => void }

/** Full-screen editor to annotate (arrows, boxes, pen, text, redaction) and crop an image. */
export function ImageEditor({ fileId, onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [bmp, setBmp] = useState<ImageBitmap | null>(null)
  const [failed, setFailed] = useState(false)
  const [tool, setTool] = useState<Tool>('arrow')
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(1) // 0 small, 1 medium, 2 large
  const [shapes, setShapes] = useState<Shape[]>([])
  const [crop, setCrop] = useState<Box | null>(null)
  const [history, setHistory] = useState<Snapshot[]>([])
  const [draft, setDraft] = useState<Shape | { t: 'crop'; box: Box } | null>(null)
  const [text, setText] = useState<{ x: number; y: number; left: number; top: number; value: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    fetchImageBlob(fileId).then(b => createImageBitmap(b)).then(b => alive && setBmp(b), () => alive && setFailed(true))
    return () => { alive = false }
  }, [fileId])

  // Stroke/text size scales with the image so annotations look the same on any resolution
  const k = bmp ? Math.max(1, Math.max(bmp.width, bmp.height) / 1000) : 1
  const strokeW = [2.5, 5, 9][size] * k
  const fontSize = [18, 26, 38][size] * k

  // Redraw everything on every change (cheap for screenshots)
  useEffect(() => {
    const c = canvasRef.current
    if (!c || !bmp) return
    c.width = bmp.width
    c.height = bmp.height
    const ctx = c.getContext('2d')!
    ctx.drawImage(bmp, 0, 0)
    shapes.forEach(s => paint(ctx, s))
    if (draft && draft.t !== 'crop') paint(ctx, draft)
    const box = draft?.t === 'crop' ? draft.box : crop
    if (box) {
      const r = norm(box)
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.beginPath()
      ctx.rect(0, 0, c.width, c.height)
      ctx.rect(r.x, r.y, r.w, r.h)
      ctx.fill('evenodd')
      ctx.setLineDash([8 * k, 6 * k])
      ctx.lineWidth = 2 * k
      ctx.strokeStyle = '#fff'
      ctx.strokeRect(r.x, r.y, r.w, r.h)
      ctx.restore()
    }
  }, [bmp, shapes, draft, crop, k])

  const snapshot = () => setHistory(h => [...h, { shapes, crop }])
  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setShapes(last.shapes)
    setCrop(last.crop)
    setHistory(h => h.slice(0, -1))
  }

  const latest = useRef({ undo, onClose, text })
  useEffect(() => { latest.current = { undo, onClose, text } })
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (latest.current.text) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); latest.current.undo() }
      else if (e.key === 'Escape') latest.current.onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const toImage = (e: ReactPointerEvent) => {
    const c = canvasRef.current!, r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height), left: e.clientX - r.left, top: e.clientY - r.top }
  }

  // Text box closes via Enter, blur or Escape; the ref makes sure it's placed only once
  const textRef = useRef(text)
  useEffect(() => { textRef.current = text }, [text])
  const closeText = (place: boolean) => {
    const t = textRef.current
    if (!t) return
    textRef.current = null
    if (place && t.value.trim()) {
      snapshot()
      setShapes(s => [...s, { t: 'text', x: t.x, y: t.y, text: t.value, color, size: fontSize }])
    }
    setText(null)
  }

  const onDown = (e: ReactPointerEvent) => {
    if (!bmp || e.button !== 0) return
    const p = toImage(e)
    if (tool === 'text') { if (!text) setText({ ...p, value: '' }); return } // a click while typing just blurs (= places) the text
    e.currentTarget.setPointerCapture(e.pointerId)
    const box = { x1: p.x, y1: p.y, x2: p.x, y2: p.y }
    setDraft(tool === 'crop' ? { t: 'crop', box } : tool === 'pen' ? { t: 'pen', pts: [[p.x, p.y]], color, w: strokeW } : { t: tool, ...box, color, w: strokeW })
  }
  const onMove = (e: ReactPointerEvent) => {
    if (!draft) return
    const { x, y } = toImage(e)
    setDraft(d => !d || d.t === 'text' ? d
      : d.t === 'crop' ? { ...d, box: { ...d.box, x2: x, y2: y } }
      : d.t === 'pen' ? { ...d, pts: [...d.pts, [x, y]] }
      : { ...d, x2: x, y2: y })
  }
  const onUp = () => {
    if (!draft) return
    const big = (b: Box) => Math.abs(b.x2 - b.x1) > 4 * k || Math.abs(b.y2 - b.y1) > 4 * k
    if (draft.t === 'crop') { if (big(draft.box)) { snapshot(); setCrop(draft.box) } }
    else if (draft.t === 'pen' || (draft.t !== 'text' && big(draft))) { snapshot(); setShapes(s => [...s, draft]) }
    setDraft(null)
  }

  const save = async () => {
    if (!bmp) return
    setBusy(true)
    try {
      const r = crop ? norm(crop) : { x: 0, y: 0, w: bmp.width, h: bmp.height }
      const x = Math.max(0, Math.round(r.x)), y = Math.max(0, Math.round(r.y))
      const w = Math.min(bmp.width - x, Math.round(r.w)), h = Math.min(bmp.height - y, Math.round(r.h))
      const out = document.createElement('canvas')
      out.width = w
      out.height = h
      const ctx = out.getContext('2d')!
      ctx.translate(-x, -y)
      ctx.drawImage(bmp, 0, 0)
      shapes.forEach(s => paint(ctx, s))
      const blob = await new Promise<Blob | null>(res => out.toBlob(res, 'image/png'))
      if (!blob) throw new Error('Could not export the image')
      await onSave(new File([blob], 'annotated.png', { type: 'image/png' }))
    } finally {
      setBusy(false)
    }
  }

  const btn = (active: boolean) => `grid size-9 place-items-center rounded-lg transition ${active ? 'bg-indigo-500 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`

  return (
    <div role="dialog" aria-modal="true" aria-label="Edit image" className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-zinc-950/95 text-zinc-100">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <div className="flex gap-1">
          {TOOLS.map(([t, label, Icon]) => (
            <button key={t} title={label} aria-label={label} aria-pressed={tool === t} className={btn(tool === t)} onClick={() => setTool(t)}><Icon className="size-5" /></button>
          ))}
        </div>
        <span className="mx-1 h-6 w-px bg-zinc-700" />
        <div className="flex gap-1">
          {COLORS.map(c => (
            <button key={c} title={c} aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)}
              className={`size-7 rounded-full border-2 ${color === c ? 'border-indigo-400 ring-2 ring-indigo-400/40' : 'border-zinc-600'}`} style={{ background: c }} />
          ))}
        </div>
        <span className="mx-1 h-6 w-px bg-zinc-700" />
        <div className="flex gap-1 text-sm">
          {['S', 'M', 'L'].map((l, i) => <button key={l} title={`Size ${l}`} aria-pressed={size === i} className={btn(size === i)} onClick={() => setSize(i)}>{l}</button>)}
        </div>
        <span className="mx-1 h-6 w-px bg-zinc-700" />
        <button title="Undo (Ctrl+Z)" aria-label="Undo" className={btn(false)} disabled={!history.length} onClick={undo}><Undo2 className="size-5" /></button>
        {crop && <button className="rounded-lg px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800" onClick={() => { snapshot(); setCrop(null) }}>Remove crop</button>}
        <div className="ml-auto flex gap-2">
          <button className="btn text-zinc-300 hover:bg-zinc-800" onClick={onClose}><X className="size-5" /> Cancel</button>
          <button className="btn-primary" disabled={!bmp || busy || (!shapes.length && !crop)} onClick={save}>
            {busy ? <><Loader2 className="size-5 animate-spin" /> Saving…</> : 'Save image'}
          </button>
        </div>
      </div>

      <div className="grid flex-1 place-items-center overflow-auto p-4">
        {failed ? <p className="text-sm text-zinc-400">Couldn’t load this image.</p>
          : !bmp ? <Loader2 className="size-8 animate-spin text-zinc-500" />
          : (
            <div className="relative">
              <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                className={`block max-h-[calc(100vh-7rem)] max-w-full touch-none rounded shadow-2xl ${tool === 'text' ? 'cursor-text' : 'cursor-crosshair'}`} />
              {text && (
                <textarea autoFocus value={text.value} rows={Math.max(1, text.value.split('\n').length)}
                  onChange={e => setText({ ...text, value: e.target.value })}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); closeText(true) }
                    if (e.key === 'Escape') { e.preventDefault(); closeText(false) }
                  }}
                  onBlur={() => closeText(true)} placeholder="Type, Enter to place"
                  style={{ left: text.left, top: text.top, color }}
                  className="absolute min-w-40 resize-none rounded border border-indigo-400 bg-zinc-900/80 px-1 text-base font-bold outline-none" />
              )}
            </div>
          )}
      </div>
      <p className="pb-2 text-center text-xs text-zinc-500">Drag to draw · Text: click where it goes · Redact hides passwords/tokens for good · Crop: drag the area to keep</p>
    </div>
  )
}
