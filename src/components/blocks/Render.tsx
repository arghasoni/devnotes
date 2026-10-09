import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ArrowDown, ArrowUp, Check, Copy, GripVertical } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import { type Block } from '../../lib/data'
import { NoteImage, openImage } from '../NoteImage'
import { SortableItem, useSortSensors } from '../Sortable'

export function Markdown({ text }: { text: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text, { async: false, breaks: true }) as string), [text])
  return <div className="prose prose-lg prose-zinc dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}

export function CodeView({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false)
  const html = useMemo(() => {
    try {
      return lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : hljs.highlightAuto(code).value
    } catch { return code.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!) }
  }, [code, lang])
  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <div className="group relative my-4 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5 text-sm text-zinc-400">
        <span>{lang || 'code'}</span>
        <button onClick={copy} className="flex items-center gap-1.5 rounded px-2 py-0.5 hover:bg-zinc-800">{copied ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy</>}</button>
      </div>
      <pre className="overflow-x-auto p-4 text-[0.95rem] leading-relaxed"><code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /></pre>
    </div>
  )
}

export function ImageView({ fileId, caption }: { fileId: string; caption: string }) {
  return (
    <figure className="my-6">
      <button type="button" onClick={() => openImage(fileId)} className="block w-full cursor-zoom-in" title="Open full size">
        <NoteImage fileId={fileId} alt={caption.split('\n')[0]} className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800" />
      </button>
      {caption && <figcaption className="mt-2 border-l-2 border-indigo-300 pl-3 dark:border-zinc-700"><Markdown text={caption} /></figcaption>}
    </figure>
  )
}

const blockView = (b: Block) =>
  b.type === 'text' ? <div className="my-4"><Markdown text={b.content} /></div>
  : b.type === 'code' ? <CodeView code={b.content} lang={b.lang} />
  : <ImageView fileId={b.fileId} caption={b.caption} />

/** Read-only blocks. With `onReorder`, each block gets a hover toolbar to drag or move it. */
export function BlocksView({ blocks, onReorder }: { blocks: Block[]; onReorder?: (blocks: Block[]) => void }) {
  const sensors = useSortSensors()
  if (!onReorder) return <>{blocks.map(b => <Fragment key={b.id}>{blockView(b)}</Fragment>)}</>

  const moveTo = (from: number, to: number) => { if (to >= 0 && to < blocks.length) onReorder(arrayMove(blocks, from, to)) }
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) moveTo(blocks.findIndex(b => b.id === active.id), blocks.findIndex(b => b.id === over.id))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
      <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
        {blocks.map((b, i) => (
          <SortableItem key={b.id} id={b.id}>{(handle, dragging) => (
            <div className={`group rounded-lg ${dragging ? 'bg-white px-2 shadow-lg ring-1 ring-indigo-400 dark:bg-zinc-950' : ''}`}>
              <div className={`absolute -top-3 right-2 z-10 gap-1 rounded-md border border-zinc-200 bg-white px-1 text-xs group-hover:flex group-focus-within:flex dark:border-zinc-700 dark:bg-zinc-900 ${dragging ? 'flex' : 'hidden'}`}>
                <button {...handle} className="cursor-grab touch-none px-1.5 py-0.5 text-zinc-500 active:cursor-grabbing" title="Drag to reorder (or focus and press Space, then arrow keys)"><GripVertical className="size-4" /></button>
                <button className="px-1.5 py-0.5" onClick={() => moveTo(i, i - 1)} title="Move up"><ArrowUp className="size-4" /></button>
                <button className="px-1.5 py-0.5" onClick={() => moveTo(i, i + 1)} title="Move down"><ArrowDown className="size-4" /></button>
              </div>
              {blockView(b)}
            </div>
          )}</SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  )
}
