import { ArrowLeft, Check, Folder as FolderIcon, Link2, Pencil, Download, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useApp } from './Layout'
import { BlocksView } from '../components/blocks/Render'
import { NoteEditor, type Draft } from '../components/NoteEditor'
import { folderPath } from '../components/Sidebar'
import { deleteNote, downloadMarkdown, getNote, newBlockId, saveNote, type Note } from '../lib/data'
import { reportError } from '../lib/errors'
import { ThemeToggle } from '../lib/theme'
import { ConfirmDialog } from '../components/Dialog'

function Article({ note, meta }: { note: Note; meta?: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{note.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.95rem] text-zinc-500">
        <span>Updated {new Date(note.$updatedAt).toLocaleString()}</span>
        {meta}
      </div>
      <hr className="my-8 border-zinc-200 dark:border-zinc-800" />
      <BlocksView blocks={note.blocks} />
    </article>
  )
}

export function NoteView() {
  const { id } = useParams()
  const { notes, folders, reload, loaded } = useApp()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const note = notes.find(n => n.$id === id)

  if (!note) return <p className="p-8 text-sm text-zinc-500">{loaded ? 'Note not found.' : 'Loading…'}</p>

  const folder = folders.find(f => f.$id === note.folderId)
  const shareUrl = `${location.origin}/s/${note.$id}`

  const remove = async () => {
    try { await deleteNote(note); await reload(); navigate('/') } catch (e) { reportError(e) }
  }
  const copyLink = async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  return (
    <>
      <div className="mx-auto flex max-w-3xl flex-wrap gap-1 px-4 pt-4">
        <button className="btn-ghost" onClick={() => navigate(-1)}><ArrowLeft className="size-5" /> Back</button>
        <div className="ml-auto flex flex-wrap gap-1">
          {note.isPublic && <button className="btn-ghost" onClick={copyLink}>{copied ? <><Check className="size-5" /> Link copied</> : <><Link2 className="size-5" /> Copy share link</>}</button>}
          <button className="btn-ghost" onClick={() => downloadMarkdown(note)}><Download className="size-5" /> Export .md</button>
          <Link className="btn-ghost" to={`/note/${note.$id}/edit`}><Pencil className="size-5" /> Edit</Link>
          <button className="btn-ghost text-red-500" onClick={() => setConfirmDelete(true)}><Trash2 className="size-5" /> Delete</button>
        </div>
      </div>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={remove}
        title="Delete this note?" description="This permanently removes the note and its images." confirmLabel="Delete note" />
      <Article note={note} meta={folder && <Link to={`/?folder=${folder.$id}`} className="inline-flex items-center gap-1.5 hover:underline"><FolderIcon className="size-4 text-amber-500" /> {folderPath(folder, folders)}</Link>} />
    </>
  )
}

export function NoteEdit() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { userId, notes, folders, reload, loaded } = useApp()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const existing = id ? notes.find(n => n.$id === id) : undefined

  const onSave = useCallback(async (d: Draft) => {
    setSaving(true)
    try {
      const saved = await saveNote(userId, { ...d, id })
      await reload()
      navigate(`/note/${saved.$id}`, { replace: true })
    } catch (e) {
      reportError(e)
    } finally {
      setSaving(false)
    }
  }, [userId, id, reload, navigate])

  if (id && !existing) return <p className="p-8 text-sm text-zinc-500">{loaded ? 'Note not found.' : 'Loading…'}</p>

  const initial: Draft = existing
    ? { title: existing.title, folderId: existing.folderId, blocks: existing.blocks, isPublic: existing.isPublic }
    : { title: '', folderId: params.get('folder') ?? '', blocks: [{ id: newBlockId(), type: 'text', content: '' }], isPublic: false }

  return <NoteEditor key={id ?? 'new'} userId={userId} folders={folders} initial={initial} saving={saving}
    onSave={onSave} onCancel={() => navigate(-1)} />
}

export function SharedNote() {
  const { id } = useParams()
  const [note, setNote] = useState<Note | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (id) getNote(id).then(setNote, () => setMissing(true))
  }, [id])

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <Link to="/" className="flex items-center gap-2 text-lg font-extrabold"><img src="/logo.png" alt="" className="size-8" /> DevNotes</Link>
        <ThemeToggle />
      </header>
      {missing ? <p className="p-8 text-center text-sm text-zinc-500">This note doesn’t exist or isn’t shared.</p>
        : !note ? <p className="p-8 text-sm text-zinc-500">Loading…</p>
        : <Article note={note} meta={<button className="hover:underline" onClick={() => downloadMarkdown(note)}><Download className="size-5" /> Export .md</button>} />}
    </div>
  )
}
