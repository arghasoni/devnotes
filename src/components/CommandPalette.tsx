import { Clock, CornerDownLeft, FileText, Folder as FolderIcon, Pin, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Folder, Note } from '../lib/data'
import { folderPath } from './Sidebar'

export type PaletteAction = { id: string; label: string; icon: ReactNode; keywords?: string; run: () => unknown }
type Item = { key: string; group: string; label: string; sub?: string; icon: ReactNode; run: () => unknown; score: number }

/** Higher is better; 0 = no match. Prefix > substring > in-order letters ("gtcm" → "git commands"). */
function score(text: string, q: string) {
  const t = text.toLowerCase()
  if (t.startsWith(q)) return 100
  const i = t.indexOf(q)
  if (i >= 0) return 80 - Math.min(i, 30) / 2
  let j = 0
  for (const c of t) if (c === q[j]) j++
  return j === q.length ? 40 : 0
}

/** Mount only while open — it starts with an empty query each time. */
type Props = {
  onClose: () => void
  notes: Note[]; folders: Folder[]; pinned: string[]; recent: string[]; actions: PaletteAction[]
}

export function CommandPalette({ onClose, notes, folders, pinned, recent, actions }: Props) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo<Item[]>(() => {
    const query = q.trim().toLowerCase()
    const go = (to: string) => () => navigate(to)
    const noteItem = (n: Note, group: string, s: number, icon: ReactNode = <FileText className="size-4" />): Item => {
      const f = folders.find(x => x.$id === n.folderId)
      return { key: `${group}:${n.$id}`, group, label: n.title, sub: f ? folderPath(f, folders) : undefined, icon, run: go(`/note/${n.$id}`), score: s }
    }
    const byId = (ids: string[]) => ids.map(id => notes.find(n => n.$id === id)).filter((n): n is Note => !!n)

    if (!query) {
      return [
        ...byId(pinned).map(n => noteItem(n, 'Pinned', 0, <Pin className="size-4" />)),
        ...byId(recent).filter(n => !pinned.includes(n.$id)).slice(0, 6).map(n => noteItem(n, 'Recently viewed', 0, <Clock className="size-4" />)),
        ...actions.map(a => ({ key: a.id, group: 'Actions', label: a.label, icon: a.icon, run: a.run, score: 0 })),
      ]
    }

    const terms = query.split(/\s+/)
    const noteHits = notes.map(n => {
      const s = Math.max(score(n.title, query), terms.every(t => n.searchText.includes(t)) ? 20 : 0)
      return noteItem(n, 'Notes', s + (pinned.includes(n.$id) ? 5 : 0))
    }).filter(i => i.score > 0).sort((a, b) => b.score - a.score).slice(0, 30)
    const folderHits = folders.map(f => ({
      key: `f:${f.$id}`, group: 'Folders', label: folderPath(f, folders), icon: <FolderIcon className="size-4" />,
      run: go(`/?folder=${f.$id}`), score: score(folderPath(f, folders), query),
    })).filter(i => i.score > 0).sort((a, b) => b.score - a.score).slice(0, 8)
    const actionHits = actions.map(a => ({ key: a.id, group: 'Actions', label: a.label, icon: a.icon, run: a.run, score: Math.max(score(a.label, query), score(a.keywords ?? '', query)) }))
      .filter(i => i.score > 0).sort((a, b) => b.score - a.score)
    const search: Item = { key: 'search', group: 'Search', label: `Search all notes for “${q.trim()}”`, icon: <Search className="size-4" />, run: go(`/?q=${encodeURIComponent(q.trim())}`), score: 0 }
    return [...noteHits, ...folderHits, ...actionHits, search]
  }, [q, notes, folders, pinned, recent, actions, navigate])

  // Keep the highlighted row on screen
  useEffect(() => { listRef.current?.querySelector('[data-sel="true"]')?.scrollIntoView({ block: 'nearest' }) }, [sel])

  const run = (i: Item | undefined) => { if (!i) return; onClose(); i.run() }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(items.length - 1, s + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(items[sel]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <div className="animate-fade-in absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Command palette"
        className="animate-pop-in relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
          <Search className="size-5 shrink-0 text-zinc-400" />
          <input autoFocus value={q} onChange={e => { setQ(e.target.value); setSel(0) }} onKeyDown={onKeyDown}
            placeholder="Jump to a note or folder, or run an action…" className="w-full bg-transparent py-3.5 outline-none"
            role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={items[sel]?.key} />
          <kbd className="rounded border border-zinc-300 px-1.5 text-xs text-zinc-500 dark:border-zinc-700">Esc</kbd>
        </div>
        <div ref={listRef} id="palette-list" role="listbox" className="overflow-y-auto p-2">
          {items.length === 0 && <p className="p-4 text-center text-sm text-zinc-500">Nothing yet — create a note first.</p>}
          {items.map((it, i) => (
            <div key={it.key}>
              {(i === 0 || items[i - 1].group !== it.group) && <div className="px-2 pt-2 pb-1 text-xs font-semibold tracking-wide text-zinc-400 uppercase">{it.group}</div>}
              <button id={it.key} role="option" aria-selected={i === sel} data-sel={i === sel}
                onMouseMove={() => setSel(i)} onClick={() => run(it)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === sel ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' : ''}`}>
                <span className="shrink-0 text-zinc-400">{it.icon}</span>
                <span className="truncate">{it.label}</span>
                {it.sub && <span className="truncate text-sm text-zinc-400">{it.sub}</span>}
                {i === sel && <CornerDownLeft className="ml-auto size-4 shrink-0 text-zinc-400" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
