import { Archive, FilePlus2, Home, LogOut, Menu, Moon, Pencil, Pin, PinOff, Plus, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, matchPath, Navigate, Outlet, useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ThemeToggle, toggleTheme } from '../lib/theme'
import { getPrefs, listFolders, listNotes, updatePrefs, type Folder, type Note } from '../lib/data'
import { exportAll } from '../lib/backup'
import { Sidebar } from '../components/Sidebar'
import { CommandPalette, type PaletteAction } from '../components/CommandPalette'
import { reportError } from '../lib/errors'
import { Backdrop, Logo } from '../components/Backdrop'

const SIDEBAR_MIN = 220, SIDEBAR_MAX = 520, SIDEBAR_DEFAULT = 290
const clampWidth = (w: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(w)))
const storedWidth = () => {
  try { const w = Number(localStorage.getItem('sidebar-width')); return w ? clampWidth(w) : SIDEBAR_DEFAULT } catch { return SIDEBAR_DEFAULT }
}

const RECENT_KEY = 'recent-notes'
const storedRecent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}

export type AppCtx = {
  userId: string; folders: Folder[]; notes: Note[]; reload: () => Promise<void>; loaded: boolean
  pinned: string[]; togglePin: (noteId: string) => void; markViewed: (noteId: string) => void
}
export const useApp = () => useOutletContext<AppCtx>()

export function Layout() {
  const { user, loading, logout } = useAuth()
  const [folders, setFolders] = useState<Folder[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [loaded, setLoaded] = useState(false)
  const [menu, setMenu] = useState(false)
  const [width, setWidth] = useState(storedWidth)
  const [resizing, setResizing] = useState(false)
  const [error, setError] = useState('')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [pinned, setPinned] = useState<string[]>([])
  const [recent, setRecent] = useState<string[]>(storedRecent) // per browser; ids of other accounts never match a note
  const [palette, setPalette] = useState(false)
  const [exporting, setExporting] = useState('')
  const location = useLocation()

  const reload = useCallback(async () => {
    if (!user) return
    try {
      const prefs = getPrefs()
      const [f, n, p] = await Promise.all([prefs.then(p => listFolders(user.$id, p.folderOrder)), listNotes(user.$id), prefs])
      setFolders(f)
      setNotes(n)
      setPinned(p.pinnedNotes ?? [])
    } catch (e) {
      reportError(e)
    } finally {
      setLoaded(true)
    }
  }, [user])

  useEffect(() => { reload() }, [reload])

  const togglePin = useCallback((noteId: string) => {
    const next = pinned.includes(noteId) ? pinned.filter(id => id !== noteId) : [noteId, ...pinned]
    setPinned(next)
    updatePrefs({ pinnedNotes: next }).catch(e => { reportError(e); setPinned(pinned) })
  }, [pinned])

  const markViewed = useCallback((noteId: string) => {
    setRecent(prev => prev[0] === noteId ? prev : [noteId, ...prev.filter(id => id !== noteId)].slice(0, 15))
  }, [])
  useEffect(() => {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)) } catch { /* ignore */ }
  }, [recent])

  // Ctrl/Cmd+K opens the command palette from anywhere
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const runExport = useCallback(async () => {
    if (exporting) return
    setExporting('Preparing backup…')
    try {
      const r = await exportAll(notes, folders, setExporting)
      setExporting(`Backup downloaded: ${r.notes} notes, ${r.images} images${r.failed ? ` (${r.failed} images failed)` : ''}`)
      setTimeout(() => setExporting(''), 4000)
    } catch (e) {
      reportError(e)
      setExporting('')
    }
  }, [notes, folders, exporting])

  const currentNoteId = matchPath('/note/:id/*', location.pathname)?.params.id
  const actions = useMemo<PaletteAction[]>(() => {
    const folderParam = params.get('folder')
    const list: PaletteAction[] = [
      { id: 'new', label: 'New note', icon: <Plus className="size-4" />, keywords: 'create add', run: () => navigate('/new') },
    ]
    if (folderParam) list.push({ id: 'new-here', label: 'New note in this folder', icon: <FilePlus2 className="size-4" />, keywords: 'create add', run: () => navigate(`/new?folder=${folderParam}`) })
    if (currentNoteId) {
      const isPinned = pinned.includes(currentNoteId)
      list.push(
        { id: 'pin', label: isPinned ? 'Unpin this note' : 'Pin this note', icon: isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />, keywords: 'favourite favorite star', run: () => togglePin(currentNoteId) },
        { id: 'edit', label: 'Edit this note', icon: <Pencil className="size-4" />, run: () => navigate(`/note/${currentNoteId}/edit`) },
      )
    }
    list.push(
      { id: 'home', label: 'Go to all notes', icon: <Home className="size-4" />, keywords: 'home dashboard', run: () => navigate('/') },
      { id: 'export', label: 'Export all notes (.zip backup)', icon: <Archive className="size-4" />, keywords: 'download backup markdown', run: runExport },
      { id: 'theme', label: 'Toggle dark / light theme', icon: <Moon className="size-4" />, keywords: 'dark mode', run: toggleTheme },
      { id: 'logout', label: 'Sign out', icon: <LogOut className="size-4" />, keywords: 'logout', run: logout },
    )
    return list
  }, [params, currentNoteId, pinned, togglePin, runExport, navigate, logout])

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const h = (e: Event) => { setError((e as CustomEvent).detail); clearTimeout(t); t = setTimeout(() => setError(''), 6000) }
    window.addEventListener('app-error', h)
    return () => window.removeEventListener('app-error', h)
  }, [])

  useEffect(() => {
    try { localStorage.setItem('sidebar-width', String(width)) } catch { /* ignore */ }
  }, [width])

  const startResize = (e: ReactPointerEvent) => {
    e.preventDefault()
    const startX = e.clientX, startW = width
    setResizing(true)
    const move = (ev: PointerEvent) => setWidth(clampWidth(startW + ev.clientX - startX))
    const up = () => {
      setResizing(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  if (loading) return <div className="p-8 text-sm text-zinc-500">Loading…</div>
  if (!user) return <Navigate to="/login" replace />

  const search = (value: string) => {
    setQ(value)
    const p = new URLSearchParams(params)
    if (value) p.set('q', value); else p.delete('q')
    navigate(`/?${p}`, { replace: true })
  }

  const newNote = () => navigate(`/new${params.get('folder') ? `?folder=${params.get('folder')}` : ''}`)

  return (
    <div className="relative isolate flex h-screen">
      <Backdrop />
      <aside style={{ '--sidebar-w': `${width}px` } as CSSProperties}
        className={`${menu ? 'animate-fade-in fixed inset-0 z-30 flex bg-white dark:bg-zinc-950' : 'hidden'} relative shrink-0 flex-col border-r border-zinc-200/70 bg-white/60 backdrop-blur-xl md:static md:flex md:w-[var(--sidebar-w)] dark:border-zinc-800/70 dark:bg-zinc-950/50 ${resizing ? 'select-none' : ''}`}>
        <div className="flex items-center justify-between px-5 pt-5">
          <Link to="/" className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight"><Logo size={34} /> <span className="text-gradient">DevNotes</span></Link>
          <button className="btn-ghost md:hidden" onClick={() => setMenu(false)} aria-label="Close menu"><X className="size-5" /></button>
        </div>
        <Sidebar userId={user.$id} folders={folders} notes={notes} reload={reload} setFolders={setFolders} onNavigate={() => setMenu(false)}
          pinned={pinned} recent={recent} onExport={runExport} exporting={!!exporting} />
        <div role="separator" aria-orientation="vertical" aria-label="Resize sidebar" tabIndex={0}
          aria-valuemin={SIDEBAR_MIN} aria-valuemax={SIDEBAR_MAX} aria-valuenow={width}
          title="Drag to resize · double-click to reset"
          onPointerDown={startResize} onDoubleClick={() => setWidth(SIDEBAR_DEFAULT)}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft') setWidth(w => clampWidth(w - 16))
            if (e.key === 'ArrowRight') setWidth(w => clampWidth(w + 16))
          }}
          className={`group absolute inset-y-0 -right-1.5 z-10 hidden w-3 cursor-col-resize md:block`}>
          <span className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full transition-colors ${resizing ? 'bg-indigo-500' : 'bg-transparent group-hover:bg-indigo-400/70 group-focus-visible:bg-indigo-500'}`} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-zinc-200/70 bg-white/60 px-5 py-3 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-950/50">
          <button className="btn-ghost md:hidden" onClick={() => setMenu(true)} aria-label="Menu"><Menu className="size-5" /></button>
          <label className="relative w-full max-w-md"><Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-zinc-400" /><input className="input pr-20 pl-10" placeholder="Search notes, commands, captions…" value={q} onChange={e => search(e.target.value)} />
            <button type="button" onClick={() => setPalette(true)} title="Command palette — jump anywhere"
              className="absolute top-1/2 right-2 hidden -translate-y-1/2 rounded-md border border-zinc-300 px-1.5 py-0.5 text-xs text-zinc-500 hover:border-indigo-400 hover:text-indigo-600 sm:block dark:border-zinc-700">Ctrl K</button></label>
          <button className="btn-primary ml-auto whitespace-nowrap" onClick={newNote}><Plus className="size-5" /> Add note</button>
          <ThemeToggle />
          <button className="btn-ghost hidden sm:inline-flex" onClick={logout} title={user.email}><LogOut className="size-5" /> Sign out</button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet context={{ userId: user.$id, folders, notes, reload, loaded, pinned, togglePin, markViewed } satisfies AppCtx} />
        </main>
      </div>

      {palette && <CommandPalette onClose={() => setPalette(false)} notes={notes} folders={folders} pinned={pinned} recent={recent} actions={actions} />}

      {exporting && (
        <div className="animate-pop-in fixed bottom-4 left-4 z-50 flex max-w-sm items-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-zinc-800">
          <Archive className="size-4 shrink-0" /> {exporting}
        </div>
      )}

      {error && (
        <div className="animate-pop-in fixed right-4 bottom-4 z-50 max-w-sm rounded-lg bg-red-600 px-4 py-3 text-sm text-white shadow-lg" onClick={() => setError('')}>
          {error}
        </div>
      )}
    </div>
  )
}
