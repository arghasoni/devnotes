import { LogOut, Menu, Plus, Search, X } from 'lucide-react'
import { useCallback, useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, Navigate, Outlet, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ThemeToggle } from '../lib/theme'
import { listFolders, listNotes, type Folder, type Note } from '../lib/data'
import { Sidebar } from '../components/Sidebar'
import { reportError } from '../lib/errors'
import { Backdrop, Logo } from '../components/Backdrop'

const SIDEBAR_MIN = 220, SIDEBAR_MAX = 520, SIDEBAR_DEFAULT = 290
const clampWidth = (w: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(w)))
const storedWidth = () => {
  try { const w = Number(localStorage.getItem('sidebar-width')); return w ? clampWidth(w) : SIDEBAR_DEFAULT } catch { return SIDEBAR_DEFAULT }
}

export type AppCtx = { userId: string; folders: Folder[]; notes: Note[]; reload: () => Promise<void>; loaded: boolean }
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

  const reload = useCallback(async () => {
    if (!user) return
    try {
      const [f, n] = await Promise.all([listFolders(user.$id), listNotes(user.$id)])
      setFolders(f)
      setNotes(n)
    } catch (e) {
      reportError(e)
    } finally {
      setLoaded(true)
    }
  }, [user])

  useEffect(() => { reload() }, [reload])

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
        <Sidebar userId={user.$id} folders={folders} notes={notes} reload={reload} onNavigate={() => setMenu(false)} />
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
          <label className="relative w-full max-w-md"><Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-zinc-400" /><input className="input pl-10" placeholder="Search notes, commands, captions…" value={q} onChange={e => search(e.target.value)} /></label>
          <button className="btn-primary ml-auto whitespace-nowrap" onClick={newNote}><Plus className="size-5" /> Add note</button>
          <ThemeToggle />
          <button className="btn-ghost hidden sm:inline-flex" onClick={logout} title={user.email}><LogOut className="size-5" /> Sign out</button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet context={{ userId: user.$id, folders, notes, reload, loaded } satisfies AppCtx} />
        </main>
      </div>

      {error && (
        <div className="animate-pop-in fixed right-4 bottom-4 z-50 max-w-sm rounded-lg bg-red-600 px-4 py-3 text-sm text-white shadow-lg" onClick={() => setError('')}>
          {error}
        </div>
      )}
    </div>
  )
}
