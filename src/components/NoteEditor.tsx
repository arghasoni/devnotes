import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ArrowDown, ArrowUp, Brush, Code2, GripVertical, History, ImagePlus, Plus, Type, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react'
import { AutoTextarea } from './AutoTextarea'
import { ConfirmDialog } from './Dialog'
import { ImageEditor } from './ImageEditor'
import { SortableItem, useSortSensors } from './Sortable'
import { NoteImage } from './NoteImage'
import { filterSlash, type SlashCommand } from './slashCommands'
import { deleteImages, imageIds, newBlockId, uploadImage, type Block, type Folder } from '../lib/data'
import { detectCode } from '../lib/detectCode'
import { folderPath } from './Sidebar'
import { reportError } from '../lib/errors'

const LANGS = ['bash', 'powershell', 'javascript', 'typescript', 'python', 'json', 'yaml', 'sql', 'html', 'css', 'dockerfile', 'go', 'rust', 'java', 'plaintext']

// Dropped/pasted text files: extension → code language ('' = plain text block)
const FILE_LANGS: Record<string, string> = {
  sh: 'bash', bash: 'bash', zsh: 'bash', env: 'bash', ps1: 'powershell', psm1: 'powershell', js: 'javascript', mjs: 'javascript',
  cjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', json: 'json', yml: 'yaml', yaml: 'yaml',
  sql: 'sql', html: 'html', htm: 'html', xml: 'html', css: 'css', go: 'go', rs: 'rust', java: 'java', dockerfile: 'dockerfile',
  log: 'plaintext', ini: 'plaintext', toml: 'plaintext', conf: 'plaintext', csv: 'plaintext', txt: '', md: '',
}
const fileLang = (f: File): string | null => {
  const name = f.name.toLowerCase()
  const ext = name === 'dockerfile' ? 'dockerfile' : name.includes('.') ? name.split('.').pop()! : ''
  return ext in FILE_LANGS ? FILE_LANGS[ext] : null
}
const isImage = (f: File) => f.type.startsWith('image/')

export type Draft = { title: string; folderId: string; blocks: Block[]; isPublic: boolean }

// Unsaved edits are kept in localStorage so a closed tab or crash doesn't lose them
type StoredDraft = { draft: Draft; savedAt: number }
const storageKey = (key: string) => `note-draft:${key}`
const readStored = (key: string): StoredDraft | null => {
  try { const v = localStorage.getItem(storageKey(key)); return v ? JSON.parse(v) : null } catch { return null }
}
const clearStored = (key: string) => { try { localStorage.removeItem(storageKey(key)) } catch { /* ignore */ } }

type Props = {
  userId: string
  draftKey: string
  folders: Folder[]
  initial: Draft
  saving: boolean
  /** Resolves true when the note was saved. */
  onSave: (d: Draft) => Promise<boolean>
  onCancel: () => void
}

export function NoteEditor({ userId, draftKey, folders, initial, saving, onSave, onCancel }: Props) {
  const [base] = useState(initial)
  const [draft, setDraft] = useState<Draft>(initial)
  const [recovered, setRecovered] = useState(() => {
    const s = readStored(draftKey)
    return s && JSON.stringify(s.draft) !== JSON.stringify(initial) ? s : null
  })
  const [savedLocally, setSavedLocally] = useState(false)
  const [uploading, setUploading] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const insertAt = useRef<number | null>(null)
  const uploaded = useRef(new Set<string>()) // images uploaded while editing, so unused ones can be cleaned up
  const [openGap, setOpenGap] = useState<number | null>(null)
  const [slash, setSlash] = useState<{ id: string; start: number; query: string; sel: number } | null>(null)
  const [pasteHint, setPasteHint] = useState<{ id: string; start: number; text: string; lang: string } | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const [annotating, setAnnotating] = useState<{ blockId: string; fileId: string } | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const dirty = JSON.stringify(draft) !== JSON.stringify(base)

  const setBlocks = (fn: (b: Block[]) => Block[]) => setDraft(d => ({ ...d, blocks: fn(d.blocks) }))
  const update = (id: string, patch: Partial<Block>) =>
    setBlocks(bs => bs.map(b => (b.id === id ? ({ ...b, ...patch } as Block) : b)))
  const insert = (block: Block, at: number | null = null) =>
    setBlocks(bs => { const c = [...bs]; c.splice(at ?? c.length, 0, block); return c })
  const replace = (id: string, blocks: Block[]) =>
    setBlocks(bs => { const i = bs.findIndex(b => b.id === id); if (i < 0) return bs; const c = [...bs]; c.splice(i, 1, ...blocks); return c })
  const move = (i: number, dir: -1 | 1) => setBlocks(bs => {
    const j = i + dir
    if (j < 0 || j >= bs.length) return bs
    const c = [...bs]; [c[i], c[j]] = [c[j], c[i]]; return c
  })
  const remove = (id: string) => setBlocks(bs => bs.filter(b => b.id !== id))
  const focusBlock = (id: string, caret: number) => requestAnimationFrame(() => {
    const t = document.querySelector<HTMLTextAreaElement>(`[data-block="${id}"] textarea`)
    t?.focus()
    t?.setSelectionRange(caret, caret)
  })

  const sensors = useSortSensors()
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setBlocks(bs => arrayMove(bs, bs.findIndex(b => b.id === active.id), bs.findIndex(b => b.id === over.id)))
  }

  // ---------- autosave to this device ----------
  useEffect(() => {
    if (recovered) return // wait until the user decides what to do with the older draft
    const t = setTimeout(() => {
      try {
        if (dirty) localStorage.setItem(storageKey(draftKey), JSON.stringify({ draft, savedAt: Date.now() } satisfies StoredDraft))
        else localStorage.removeItem(storageKey(draftKey))
        setSavedLocally(dirty)
      } catch { /* storage full or unavailable */ }
    }, 500)
    return () => clearTimeout(t)
  }, [draft, dirty, recovered, draftKey])

  const save = async (d: Draft) => {
    if (!(await onSave(d))) return
    clearStored(draftKey)
    // Images that were removed or replaced (annotated) are no longer needed
    const keep = new Set(imageIds(d.blocks))
    deleteImages(new Set([...imageIds(base.blocks), ...uploaded.current].filter(id => !keep.has(id))))
  }
  const discard = () => {
    clearStored(draftKey)
    const inBase = new Set(imageIds(base.blocks))
    deleteImages([...uploaded.current].filter(id => !inBase.has(id)))
    onCancel()
  }

  // Ctrl+S to save
  const latestSave = useRef(() => save(draft))
  useEffect(() => { latestSave.current = () => save(draft) })
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); latestSave.current() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // ---------- files: paste, drop, picker ----------
  const addFiles = async (files: File[], at: number | null) => {
    const usable = files.filter(f => isImage(f) || fileLang(f) !== null)
    if (usable.length < files.length) reportError(new Error('Some files were skipped — only images and text/code files can be added.'))
    setUploading(n => n + usable.filter(isImage).length)
    let k = 0
    for (const f of usable) {
      const pos = at === null ? null : at + k
      if (isImage(f)) {
        try {
          const fileId = await uploadImage(userId, f)
          uploaded.current.add(fileId)
          insert({ id: newBlockId(), type: 'image', fileId, caption: '' }, pos)
          k++
        } catch (e) {
          reportError(e)
        } finally {
          setUploading(n => n - 1)
        }
      } else if (f.size > 1_000_000) {
        reportError(new Error(`${f.name} is too large to add as text (max 1 MB).`))
      } else {
        const content = (await f.text()).replace(/\r\n?/g, '\n').replace(/\n+$/, '')
        const lang = fileLang(f)!
        insert(lang ? { id: newBlockId(), type: 'code', lang, content } : { id: newBlockId(), type: 'text', content }, pos)
        k++
      }
    }
  }

  // Ctrl+V anywhere in the editor: pasted images become image blocks
  const onPaste = (e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files)
    if (files.some(isImage)) {
      e.preventDefault()
      const idx = (e.target as HTMLElement).closest('[data-idx]')?.getAttribute('data-idx')
      addFiles(files, idx != null ? Number(idx) + 1 : null)
    }
  }

  // Dropping files: the drop position follows the pointer (above/below the block's middle)
  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files')
  const onDragOver = (e: DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const el = (e.target as HTMLElement).closest('[data-drop]')
    if (!el) return setDropAt(draft.blocks.length)
    const r = el.getBoundingClientRect(), i = Number(el.getAttribute('data-drop'))
    setDropAt(e.clientY < r.top + r.height / 2 ? i : i + 1)
  }
  const onDragLeave = (e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropAt(null)
  }
  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    const at = dropAt
    setDropAt(null)
    addFiles(Array.from(e.dataTransfer.files), at === null || at >= draft.blocks.length ? null : at)
  }

  // ---------- slash commands ----------
  const slashItems = slash ? filterSlash(slash.query) : []
  const checkSlash = (id: string, el: HTMLTextAreaElement) => {
    const pos = el.selectionStart
    const m = /(?:^|\n)\/([\w-]*)$/.exec(el.value.slice(0, pos))
    setSlash(m && filterSlash(m[1]).length ? { id, start: pos - m[1].length - 1, query: m[1], sel: 0 } : null)
  }
  useEffect(() => {
    document.querySelector('[data-slash-sel="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [slash?.sel])

  const applySlash = (b: Extract<Block, { type: 'text' }>, cmd: SlashCommand) => {
    if (!slash) return
    const before = b.content.slice(0, slash.start), after = b.content.slice(slash.start + 1 + slash.query.length)
    setSlash(null)
    const a = cmd.action
    if (a.kind === 'markdown') {
      update(b.id, { content: before + a.text + after })
      focusBlock(b.id, slash.start + (a.caret ?? a.text.length))
      return
    }
    // Block commands split the text block: text before | new block | text after
    const head = before.replace(/\n$/, ''), tail = after.replace(/^\n/, '')
    const parts: Block[] = head.trim() ? [{ ...b, content: head }] : []
    const idx = draft.blocks.findIndex(x => x.id === b.id)
    if (a.kind === 'image') {
      if (tail.trim()) parts.push({ id: newBlockId(), type: 'text', content: tail })
      if (!parts.length) parts.push({ ...b, content: '' }) // keep a place to keep typing
      insertAt.current = idx + (head.trim() ? 1 : 0)
      replace(b.id, parts)
      fileRef.current?.click()
      return
    }
    parts.push(a.kind === 'code' ? { id: newBlockId(), type: 'code', lang: a.lang, content: '' } : { id: newBlockId(), type: 'text', content: '' })
    if (tail.trim()) parts.push({ id: newBlockId(), type: 'text', content: tail })
    replace(b.id, parts)
  }

  // ---------- pasted code detection ----------
  const shellLang = () =>
    [...draft.blocks].reverse().find((b): b is Extract<Block, { type: 'code' }> => b.type === 'code' && (b.lang === 'bash' || b.lang === 'powershell'))?.lang
    ?? (navigator.userAgent.includes('Windows') ? 'powershell' : 'bash')
  const convertPaste = (b: Extract<Block, { type: 'text' }>) => {
    if (!pasteHint) return
    const head = b.content.slice(0, pasteHint.start).replace(/\n$/, '')
    const tail = b.content.slice(pasteHint.start + pasteHint.text.length).replace(/^\n/, '')
    const parts: Block[] = head.trim() ? [{ ...b, content: head }] : []
    parts.push({ id: newBlockId(), type: 'code', lang: pasteHint.lang, content: pasteHint.text.replace(/^\n+|\n+$/g, '') })
    if (tail.trim()) parts.push({ id: newBlockId(), type: 'text', content: tail })
    replace(b.id, parts)
    setPasteHint(null)
  }

  // ---------- annotate ----------
  const saveAnnotated = async (file: File) => {
    if (!annotating) return
    setUploading(n => n + 1)
    try {
      const fileId = await uploadImage(userId, file)
      uploaded.current.add(fileId)
      update(annotating.blockId, { fileId })
      setAnnotating(null)
    } catch (e) {
      reportError(e)
    } finally {
      setUploading(n => n - 1)
    }
  }

  const addBar = (at: number | null) => (
    <div className="flex flex-wrap gap-1 text-sm">
      <button className="btn-ghost" onClick={() => { insert({ id: newBlockId(), type: 'text', content: '' }, at); setOpenGap(null) }}><Type className="size-5" /> Text</button>
      <button className="btn-ghost" onClick={() => { insert({ id: newBlockId(), type: 'code', lang: 'bash', content: '' }, at); setOpenGap(null) }}><Code2 className="size-5" /> Code snippet</button>
      <button className="btn-ghost" onClick={() => { insertAt.current = at; setOpenGap(null); fileRef.current?.click() }}><ImagePlus className="size-5" /> Attach image</button>
    </div>
  )

  const dropLine = <div className="flex h-5 items-center"><div className="h-1 w-full rounded-full bg-indigo-500 shadow-[0_0_8px] shadow-indigo-500/60" /></div>

  // Hover zone above each block: shows a "+" that opens the add bar at that position
  const gap = (at: number) => dropAt === at ? dropLine : openGap === at ? (
    <div className="my-1 flex items-center rounded-lg border border-dashed border-indigo-300 p-2 dark:border-indigo-800">
      {addBar(at)}
      <button className="btn-ghost ml-auto" onClick={() => setOpenGap(null)} title="Close"><X className="size-4" /></button>
    </div>
  ) : (
    <div className="group/gap relative flex h-5 items-center">
      <div className="h-px w-full bg-indigo-400/70 opacity-0 transition-opacity group-hover/gap:opacity-100" />
      <button onClick={() => setOpenGap(at)} title="Insert block here"
        className="absolute left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border border-indigo-300 bg-white text-indigo-500 opacity-0 shadow-sm transition-opacity group-hover/gap:opacity-100 focus-visible:opacity-100 dark:border-indigo-700 dark:bg-zinc-900">
        <Plus className="size-4" />
      </button>
    </div>
  )

  return (
    <div onPaste={onPaste} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} className="mx-auto max-w-3xl px-4 py-8">
      {recovered && (
        <div className="animate-pop-in mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <History className="size-5 text-amber-600" />
          <span>You have unsaved changes from {new Date(recovered.savedAt).toLocaleString()}.</span>
          <div className="ml-auto flex gap-2">
            <button className="btn-ghost" onClick={() => { clearStored(draftKey); setRecovered(null) }}>Discard</button>
            <button className="btn-primary" onClick={() => { setDraft(recovered.draft); setRecovered(null) }}>Restore</button>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={draft.folderId} onChange={e => setDraft({ ...draft, folderId: e.target.value })}>
          <option value="">No folder</option>
          {folders.map(f => <option key={f.$id} value={f.$id}>{folderPath(f, folders)}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-zinc-500">
          <input type="checkbox" checked={draft.isPublic} onChange={e => setDraft({ ...draft, isPublic: e.target.checked })} />
          Public share link
        </label>
        <div className="ml-auto flex items-center gap-2">
          {dirty && savedLocally && <span className="hidden text-xs text-zinc-400 sm:inline" title="Kept on this device until you save or cancel">Draft saved locally</span>}
          <button className="btn-ghost" onClick={() => (dirty ? setConfirmDiscard(true) : onCancel())}>Cancel</button>
          <button className="btn-primary" disabled={saving || uploading > 0} onClick={() => save(draft)}>
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
      <p className="mb-6 text-sm text-zinc-500">Tip: type <kbd className="rounded border border-zinc-300 px-1 dark:border-zinc-700">/</kbd> for commands · paste or drop screenshots and code files · Ctrl+S to save · Markdown supported</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]}
        onDragStart={() => setOpenGap(null)} onDragEnd={onDragEnd}>
      <SortableContext items={draft.blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
        {draft.blocks.map((b, i) => (
          <SortableItem key={b.id} id={b.id}>{(handle, dragging) => (<div data-drop={i}>
          {gap(i)}
          <div data-idx={i} data-block={b.id} className={`group relative rounded-lg border p-2 hover:border-zinc-200 focus-within:border-zinc-300 dark:hover:border-zinc-800 dark:focus-within:border-zinc-700 ${dragging ? 'border-indigo-400 bg-white shadow-lg dark:bg-zinc-950' : 'border-transparent'}`}>
            <div className={`absolute -top-3 right-2 z-10 gap-1 rounded-md border border-zinc-200 bg-white px-1 text-xs group-hover:flex group-focus-within:flex dark:border-zinc-700 dark:bg-zinc-900 ${dragging ? 'flex' : 'hidden'}`}>
              <button {...handle} className="cursor-grab touch-none px-1.5 py-0.5 text-zinc-500 active:cursor-grabbing" title="Drag to reorder (or focus and press Space, then arrow keys)"><GripVertical className="size-4" /></button>
              <button className="px-1.5 py-0.5" onClick={() => move(i, -1)} title="Move up"><ArrowUp className="size-4" /></button>
              <button className="px-1.5 py-0.5" onClick={() => move(i, 1)} title="Move down"><ArrowDown className="size-4" /></button>
              <button className="px-1.5 py-0.5 text-red-500" onClick={() => remove(b.id)} title="Delete block"><X className="size-4" /></button>
            </div>

            {b.type === 'text' && (
              <>
                <AutoTextarea autoFocus={!b.content} placeholder="Write something… (type / for commands, Markdown supported)" value={b.content}
                  onChange={e => { update(b.id, { content: e.target.value }); checkSlash(b.id, e.target) }}
                  onKeyDown={e => {
                    if (slash?.id !== b.id || !slashItems.length) return
                    const n = slashItems.length
                    if (e.key === 'ArrowDown') { e.preventDefault(); setSlash({ ...slash, sel: (slash.sel + 1) % n }) }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setSlash({ ...slash, sel: (slash.sel - 1 + n) % n }) }
                    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applySlash(b, slashItems[slash.sel]) }
                    else if (e.key === 'Escape') { e.preventDefault(); setSlash(null) }
                  }}
                  onBlur={() => setSlash(null)}
                  onPaste={e => {
                    if (e.clipboardData.files.length) return // images are handled by the editor-wide paste handler
                    const text = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n')
                    const lang = detectCode(text, shellLang())
                    setPasteHint(lang ? { id: b.id, start: e.currentTarget.selectionStart, text, lang } : null)
                  }}
                  role="combobox" aria-expanded={slash?.id === b.id} aria-autocomplete="list"
                  className="text-lg leading-relaxed" />

                {slash?.id === b.id && slashItems.length > 0 && (
                  <div role="listbox" aria-label="Commands"
                    className="animate-pop-in absolute top-full left-2 z-40 mt-1 max-h-72 w-80 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-xl shadow-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-900">
                    {slashItems.map((c, k) => (
                      <button key={c.key} role="option" aria-selected={k === slash.sel} data-slash-sel={k === slash.sel}
                        onMouseDown={e => { e.preventDefault(); applySlash(b, c) }}
                        onMouseMove={() => k !== slash.sel && setSlash({ ...slash, sel: k })}
                        className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left ${k === slash.sel ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' : ''}`}>
                        <span className="grid size-8 shrink-0 place-items-center rounded-md border border-zinc-200 text-zinc-500 dark:border-zinc-700">{c.icon}</span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{c.label}</span>
                          <span className="block truncate text-xs text-zinc-500">{c.hint}</span>
                        </span>
                        <span className="ml-auto font-mono text-xs text-zinc-400">/{c.key}</span>
                      </button>
                    ))}
                  </div>
                )}

                {pasteHint?.id === b.id && b.content.slice(pasteHint.start, pasteHint.start + pasteHint.text.length) === pasteHint.text && (
                  <div className="animate-pop-in mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-indigo-500/10 px-3 py-2 text-sm text-indigo-700 dark:text-indigo-300">
                    <Code2 className="size-4" /> That looks like <b>{pasteHint.lang}</b> code.
                    <button className="rounded-md bg-indigo-600 px-2.5 py-1 font-medium text-white hover:bg-indigo-500" onClick={() => convertPaste(b)}>Make it a code block</button>
                    <button className="ml-auto rounded p-1 hover:bg-indigo-500/10" onClick={() => setPasteHint(null)} title="Keep as text" aria-label="Keep as text"><X className="size-4" /></button>
                  </div>
                )}
              </>
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
                <div className="group/img relative">
                  <NoteImage fileId={b.fileId} className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800" />
                  <button onClick={() => setAnnotating({ blockId: b.id, fileId: b.fileId })}
                    className="btn absolute right-3 bottom-3 bg-zinc-900/85 text-white opacity-0 shadow-lg backdrop-blur group-hover/img:opacity-100 hover:bg-indigo-600 focus-visible:opacity-100">
                    <Brush className="size-4" /> Annotate / crop
                  </button>
                </div>
                <AutoTextarea placeholder="What is this image about? Add your notes here…" value={b.caption}
                  onChange={e => update(b.id, { caption: e.target.value })}
                  className="mt-2 border-l-2 border-indigo-300 pl-3 dark:border-zinc-700" />
              </div>
            )}

            <div className="mt-1 hidden group-focus-within:block">{addBar(i + 1)}</div>
          </div>
          </div>)}</SortableItem>
        ))}
      </SortableContext>
      </DndContext>
      {dropAt !== null && dropAt >= draft.blocks.length && dropLine}

      <div className="mt-6 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
        {addBar(null)}
        {uploading > 0 && <p className="mt-2 text-xs text-zinc-500">Uploading {uploading} image(s)…</p>}
      </div>

      {dropAt !== null && (
        <div className="animate-pop-in pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm text-white shadow-lg">
          <Upload className="size-4" /> Drop to add images or code files here
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple hidden
        onChange={e => { addFiles(Array.from(e.target.files ?? []), insertAt.current); e.target.value = '' }} />

      {annotating && <ImageEditor fileId={annotating.fileId} onSave={saveAnnotated} onClose={() => setAnnotating(null)} />}
      <ConfirmDialog open={confirmDiscard} onClose={() => setConfirmDiscard(false)} onConfirm={discard}
        title="Discard your changes?" description="Your unsaved edits to this note will be lost." confirmLabel="Discard changes" />
    </div>
  )
}
