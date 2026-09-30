import { ArrowDown, ArrowUp, Code2, ImagePlus, Type, X } from 'lucide-react'
import { useEffect, useRef, useState, type ClipboardEvent } from 'react'
import { AutoTextarea } from './AutoTextarea'
import { NoteImage } from './NoteImage'
import { newBlockId, uploadImage, type Block, type Folder } from '../lib/data'
import { folderPath } from './Sidebar'
import { reportError } from '../lib/errors'

const LANGS = ['bash', 'powershell', 'javascript', 'typescript', 'python', 'json', 'yaml', 'sql', 'html', 'css', 'dockerfile', 'go', 'rust', 'java', 'plaintext']

export type Draft = { title: string; folderId: string; blocks: Block[]; isPublic: boolean }

type Props = {
  userId: string
  folders: Folder[]
  initial: Draft
  saving: boolean
  onSave: (d: Draft) => void
  onCancel: () => void
}

export function NoteEditor({ userId, folders, initial, saving, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<Draft>(initial)
  const [uploading, setUploading] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const insertAt = useRef<number | null>(null)

  const setBlocks = (fn: (b: Block[]) => Block[]) => setDraft(d => ({ ...d, blocks: fn(d.blocks) }))
  const update = (id: string, patch: Partial<Block>) =>
    setBlocks(bs => bs.map(b => (b.id === id ? ({ ...b, ...patch } as Block) : b)))
  const insert = (block: Block, at: number | null = null) =>
    setBlocks(bs => { const c = [...bs]; c.splice(at ?? c.length, 0, block); return c })
  const move = (i: number, dir: -1 | 1) => setBlocks(bs => {
    const j = i + dir
    if (j < 0 || j >= bs.length) return bs
    const c = [...bs]; [c[i], c[j]] = [c[j], c[i]]; return c
  })
  const remove = (id: string) => setBlocks(bs => bs.filter(b => b.id !== id))

  const addImages = async (files: File[], at: number | null) => {
    const imgs = files.filter(f => f.type.startsWith('image/'))
    setUploading(n => n + imgs.length)
    for (const [k, f] of imgs.entries()) {
      try {
        const fileId = await uploadImage(userId, f)
        insert({ id: newBlockId(), type: 'image', fileId, caption: '' }, at === null ? null : at + k)
      } catch (e) {
        reportError(e)
      } finally {
        setUploading(n => n - 1)
      }
    }
  }

  // Ctrl+V anywhere in the editor: pasted images become image blocks
  const onPaste = (e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files)
    if (files.some(f => f.type.startsWith('image/'))) {
      e.preventDefault()
      const idx = (e.target as HTMLElement).closest('[data-idx]')?.getAttribute('data-idx')
      addImages(files, idx != null ? Number(idx) + 1 : null)
    }
  }

  // Ctrl+S to save
  const latest = useRef(draft)
  latest.current = draft
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); onSave(latest.current) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onSave])

  const addBar = (at: number | null) => (
    <div className="flex flex-wrap gap-1 text-sm">
      <button className="btn-ghost" onClick={() => insert({ id: newBlockId(), type: 'text', content: '' }, at)}><Type className="size-5" /> Text</button>
      <button className="btn-ghost" onClick={() => insert({ id: newBlockId(), type: 'code', lang: 'bash', content: '' }, at)}><Code2 className="size-5" /> Code snippet</button>
      <button className="btn-ghost" onClick={() => { insertAt.current = at; fileRef.current?.click() }}><ImagePlus className="size-5" /> Attach image</button>
    </div>
  )

  return (
    <div onPaste={onPaste} className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={draft.folderId} onChange={e => setDraft({ ...draft, folderId: e.target.value })}>
          <option value="">No folder</option>
          {folders.map(f => <option key={f.$id} value={f.$id}>{folderPath(f, folders)}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-zinc-500">
          <input type="checkbox" checked={draft.isPublic} onChange={e => setDraft({ ...draft, isPublic: e.target.checked })} />
          Public share link
        </label>
        <div className="ml-auto flex gap-2">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" disabled={saving || uploading > 0} onClick={() => onSave(draft)}>
            {saving ? 'Saving…' : uploading ? 'Uploading…' : 'Save'}
          </button>
        </div>
      </div>

      <AutoTextarea
        autoFocus={!draft.title}
        placeholder="Note title"
        value={draft.title}
        onChange={e => setDraft({ ...draft, title: e.target.value })}
        className="mb-2 text-4xl font-extrabold"
      />
      <p className="mb-6 text-sm text-zinc-500">Tip: paste a screenshot with Ctrl+V · Ctrl+S to save · Text supports Markdown</p>

      <div className="space-y-3">
        {draft.blocks.map((b, i) => (
          <div key={b.id} data-idx={i} className="group relative rounded-lg border border-transparent p-2 hover:border-zinc-200 focus-within:border-zinc-300 dark:hover:border-zinc-800 dark:focus-within:border-zinc-700">
            <div className="absolute -top-3 right-2 z-10 hidden gap-1 rounded-md border border-zinc-200 bg-white px-1 text-xs group-hover:flex group-focus-within:flex dark:border-zinc-700 dark:bg-zinc-900">
              <button className="px-1.5 py-0.5" onClick={() => move(i, -1)} title="Move up"><ArrowUp className="size-4" /></button>
              <button className="px-1.5 py-0.5" onClick={() => move(i, 1)} title="Move down"><ArrowDown className="size-4" /></button>
              <button className="px-1.5 py-0.5 text-red-500" onClick={() => remove(b.id)} title="Delete block"><X className="size-4" /></button>
            </div>

            {b.type === 'text' && (
              <AutoTextarea autoFocus={!b.content} placeholder="Write something… (Markdown supported)" value={b.content}
                onChange={e => update(b.id, { content: e.target.value })} className="text-lg leading-relaxed" />
            )}

            {b.type === 'code' && (
              <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100">
                <div className="border-b border-zinc-800 px-2 py-1">
                  <select value={b.lang} onChange={e => update(b.id, { lang: e.target.value })} className="bg-transparent text-sm text-zinc-400 outline-none">
                    {LANGS.map(l => <option key={l} value={l} className="bg-zinc-900">{l}</option>)}
                  </select>
                </div>
                <AutoTextarea autoFocus={!b.content} spellCheck={false} placeholder="Paste your command or code…" value={b.content}
                  onChange={e => update(b.id, { content: e.target.value })}
                  onKeyDown={e => {
                    if (e.key === 'Tab') {
                      e.preventDefault()
                      const t = e.currentTarget, s = t.selectionStart
                      update(b.id, { content: b.content.slice(0, s) + '  ' + b.content.slice(t.selectionEnd) })
                      requestAnimationFrame(() => t.setSelectionRange(s + 2, s + 2))
                    }
                  }}
                  className="p-3 font-mono text-[0.95rem]" />
              </div>
            )}

            {b.type === 'image' && (
              <div>
                <NoteImage fileId={b.fileId} className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800" />
                <AutoTextarea placeholder="What is this image about? Add your notes here…" value={b.caption}
                  onChange={e => update(b.id, { caption: e.target.value })}
                  className="mt-2 border-l-2 border-indigo-300 pl-3 dark:border-zinc-700" />
              </div>
            )}

            <div className="mt-1 hidden group-focus-within:block">{addBar(i + 1)}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
        {addBar(null)}
        {uploading > 0 && <p className="mt-2 text-xs text-zinc-500">Uploading {uploading} image(s)…</p>}
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple hidden
        onChange={e => { addImages(Array.from(e.target.files ?? []), insertAt.current); e.target.value = '' }} />
    </div>
  )
}
