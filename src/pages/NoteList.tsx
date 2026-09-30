import { ArrowRight, Code2, FileText, Folder as FolderIcon, Image, Link2, Plus } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from './Layout'
import { folderPath, subtreeIds } from '../components/Sidebar'
import { useAuth } from '../lib/auth'
import type { Block, Note } from '../lib/data'
import type { ReactNode } from 'react'

const excerpt = (blocks: Block[]) => {
  const t = blocks.find(b => b.type === 'text' && b.content.trim())
  if (t && t.type === 'text') return t.content.replace(/[#*_`>[\]()]/g, '').slice(0, 180)
  const c = blocks.find(b => b.type === 'code')
  return c && c.type === 'code' ? '$ ' + c.content.split('\n')[0].slice(0, 120) : ''
}

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// Stable accent colour per note, so the list feels lively but consistent
const ACCENTS = ['from-indigo-500 to-sky-400', 'from-violet-500 to-fuchsia-400', 'from-sky-500 to-emerald-400', 'from-blue-600 to-indigo-400', 'from-fuchsia-500 to-rose-400']
const accentOf = (id: string) => ACCENTS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % ACCENTS.length]

function Stat({ label, value, icon, gradient, delay }: { label: string; value: number; icon: ReactNode; gradient: string; delay: number }) {
  return (
    <div style={{ animationDelay: `${delay}ms` }}
      className="animate-slide-up group relative overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/70 p-5 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/10 dark:border-zinc-800/70 dark:bg-zinc-900/60">
      <div className={`absolute -top-6 -right-6 h-20 w-20 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-xl transition group-hover:scale-150 group-hover:opacity-30`} />
      <div className={`mb-3 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${gradient} text-xl font-semibold text-white shadow-md`}>{icon}</div>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      <div className="text-[0.95rem] text-zinc-500">{label}</div>
    </div>
  )
}

export function NoteList() {
  const { notes, folders, loaded } = useApp()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const folderId = params.get('folder')
  const q = (params.get('q') ?? '').trim().toLowerCase()

  const inFolder = folderId ? subtreeIds(folderId, folders) : null
  const terms = q.split(/\s+/).filter(Boolean)
  const shown = notes.filter(n =>
    (!inFolder || inFolder.has(n.folderId)) &&
    terms.every(t => n.searchText.includes(t)))

  const folder = folders.find(f => f.$id === folderId)
  const isHome = !q && !folder
  const count = (type: Block['type']) => notes.reduce((a, n) => a + n.blocks.filter(b => b.type === type).length, 0)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {isHome ? (
        <section className="mb-8">
          <p className="animate-slide-up text-lg font-medium text-indigo-600 dark:text-indigo-400">{greeting()}, {user?.name?.split(' ')[0] || 'there'} 👋</p>
          <h1 className="animate-slide-up mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl [animation-delay:60ms]">
            What did you <span className="text-gradient animate-gradient">figure out</span> today?
          </h1>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Notes" value={notes.length} icon={<FileText className="size-6" />} gradient="from-indigo-500 to-sky-400" delay={120} />
            <Stat label="Folders" value={folders.length} icon={<FolderIcon className="size-6" />} gradient="from-amber-400 to-orange-500" delay={180} />
            <Stat label="Code snippets" value={count('code')} icon={<Code2 className="size-6" />} gradient="from-violet-500 to-fuchsia-400" delay={240} />
            <Stat label="Screenshots" value={count('image')} icon={<Image className="size-6" />} gradient="from-sky-500 to-emerald-400" delay={300} />
          </div>
          <h2 className="mt-12 mb-4 text-2xl font-bold">Recent notes</h2>
        </section>
      ) : (
        <h1 className="animate-slide-up mb-6 text-3xl font-bold">
          {q ? <>Results for <span className="text-gradient">“{q}”</span></> : <span className="inline-flex items-center gap-3"><FolderIcon className="size-8 fill-amber-400/30 text-amber-500" />{folderPath(folder!, folders)}</span>}
        </h1>
      )}

      {!loaded ? (
        <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/50" />)}</div>
      ) : shown.length === 0 ? (
        <div className="animate-pop-in rounded-2xl border border-dashed border-indigo-300 bg-white/50 p-10 text-center dark:border-indigo-500/30 dark:bg-zinc-900/40">
          <img src="/logo.png" alt="" className="animate-float mx-auto mb-4 h-20 w-20" />
          <p className="font-medium">{q ? 'No notes match your search.' : 'Nothing here yet'}</p>
          {!q && (
            <>
              <p className="mt-1 text-sm text-zinc-500">Write down that command before you forget it.</p>
              <button className="btn-primary mt-5" onClick={() => navigate(`/new${folderId ? `?folder=${folderId}` : ''}`)}><Plus className="size-5" /> Write your first note</button>
            </>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map(noteCard)}
        </ul>
      )}
    </div>
  )

  function noteCard(n: Note, index: number) {
    const f = folders.find(x => x.$id === n.folderId)
    const imgs = n.blocks.filter(b => b.type === 'image').length
    const codes = n.blocks.filter(b => b.type === 'code').length
    const text = excerpt(n.blocks)
    return (
      <li key={n.$id} className="animate-slide-up" style={{ animationDelay: `${Math.min(index, 10) * 50}ms` }}>
        <Link to={`/note/${n.$id}`}
          className="group relative block overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/70 p-5 pl-6 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:hover:border-indigo-500/40">
          <span className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${accentOf(n.$id)} transition-all duration-300 group-hover:w-1.5`} />
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-semibold transition group-hover:text-indigo-600 dark:group-hover:text-indigo-300">{n.title}</h2>
            <span className="translate-x-2 text-xl text-indigo-500 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"><ArrowRight className="size-5" /></span>
          </div>
          {text && <p className="mt-1.5 line-clamp-2 text-[0.95rem] leading-relaxed text-zinc-500 dark:text-zinc-400">{text}</p>}
          <div className="mt-3.5 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-zinc-400">{new Date(n.$updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
            {f && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-300"><FolderIcon className="size-4" /> {folderPath(f, folders)}</span>}
            {codes > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-1 text-violet-700 dark:text-violet-300"><Code2 className="size-4" /> {codes}</span>}
            {imgs > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-1 text-sky-700 dark:text-sky-300"><Image className="size-4" /> {imgs}</span>}
            {n.isPublic && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300"><Link2 className="size-4" /> shared</span>}
          </div>
        </Link>
      </li>
    )
  }
}
