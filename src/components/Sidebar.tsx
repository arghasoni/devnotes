import { Folder as FolderIcon, FolderPlus, Library, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { createFolder, deleteFolder, renameFolder, type Folder, type Note } from '../lib/data'
import { reportError } from '../lib/errors'
import { ConfirmDialog, PromptDialog } from './Dialog'

export function folderPath(f: Folder, all: Folder[]): string {
  const parts = [f.name]
  let cur = f, guard = 0
  while (cur.parentId && guard++ < 20) {
    const p = all.find(x => x.$id === cur.parentId)
    if (!p) break
    parts.unshift(p.name)
    cur = p
  }
  return parts.join(' / ')
}

/** All descendant folder ids including itself. */
export function subtreeIds(id: string, all: Folder[]): Set<string> {
  const ids = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const f of all) if (ids.has(f.parentId) && !ids.has(f.$id)) { ids.add(f.$id); grew = true }
  }
  return ids
}

type Props = { userId: string; folders: Folder[]; notes: Note[]; reload: () => void; onNavigate?: () => void }

export function Sidebar({ userId, folders, notes, reload, onNavigate }: Props) {
  const [params] = useSearchParams()
  const active = params.get('folder')
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const [dialog, setDialog] = useState<
    | { kind: 'create'; parent: Folder | null }
    | { kind: 'rename' | 'delete'; folder: Folder }
    | null
  >(null)
  const close = () => setDialog(null)

  const add = (parentId = '') => setDialog({ kind: 'create', parent: folders.find(f => f.$id === parentId) ?? null })
  const rename = (f: Folder) => setDialog({ kind: 'rename', folder: f })
  const remove = (f: Folder) => setDialog({ kind: 'delete', folder: f })

  const doCreate = async (name: string) => {
    const parentId = dialog?.kind === 'create' ? dialog.parent?.$id ?? '' : ''
    try { await createFolder(userId, name, parentId); if (parentId) setOpen(o => ({ ...o, [parentId]: true })); await reload() } catch (e) { reportError(e) }
  }
  const doRename = async (name: string) => {
    if (dialog?.kind !== 'rename' || name === dialog.folder.name) return
    try { await renameFolder(dialog.folder.$id, name); await reload() } catch (e) { reportError(e) }
  }
  const doDelete = async () => {
    if (dialog?.kind !== 'delete') return
    try { await deleteFolder(dialog.folder, folders, notes); await reload() } catch (e) { reportError(e) }
  }

  const count = (id: string) => { const ids = subtreeIds(id, folders); return notes.filter(n => ids.has(n.folderId)).length }

  const tree = (parentId: string, depth: number) =>
    folders.filter(f => f.parentId === parentId).map(f => {
      const hasKids = folders.some(c => c.parentId === f.$id)
      return (
        <div key={f.$id}>
          <div className={`group flex items-center rounded-lg pr-1.5 text-[0.95rem] ${active === f.$id ? 'bg-gradient-to-r from-indigo-500/15 to-sky-500/10 font-medium text-indigo-700 dark:text-indigo-300' : 'hover:bg-indigo-500/5'}`}
            style={{ paddingLeft: depth * 16 }}>
            <button className="w-6 shrink-0 text-sm text-zinc-400" onClick={() => setOpen(o => ({ ...o, [f.$id]: !o[f.$id] }))}>
              {hasKids ? (open[f.$id] ? '▾' : '▸') : ''}
            </button>
            <Link to={`/?folder=${f.$id}`} onClick={onNavigate} className="flex flex-1 items-center gap-2 truncate py-2"><FolderIcon className="size-5 shrink-0 fill-amber-400/30 text-amber-500" /><span className="truncate">{f.name}</span></Link>
            <span className="rounded-full bg-zinc-500/10 px-2 text-sm tabular-nums text-zinc-500 group-hover:hidden">{count(f.$id) || ''}</span>
            <span className="hidden items-center gap-0.5 text-zinc-500 group-hover:flex">
              <button title="Add subfolder" className="rounded p-1.5 hover:bg-indigo-500/10 hover:text-indigo-600" onClick={() => add(f.$id)}><FolderPlus className="size-4" /></button>
              <button title="Rename" className="rounded p-1.5 hover:bg-indigo-500/10 hover:text-indigo-600" onClick={() => rename(f)}><Pencil className="size-4" /></button>
              <button title="Delete" className="rounded p-1.5 text-red-500 hover:bg-red-500/10" onClick={() => remove(f)}><Trash2 className="size-4" /></button>
            </span>
          </div>
          {open[f.$id] && tree(f.$id, depth + 1)}
        </div>
      )
    })

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-1 p-3">
      <Link to="/" onClick={onNavigate} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[0.95rem] ${!active ? 'bg-gradient-to-r from-indigo-500/15 to-sky-500/10 font-medium text-indigo-700 dark:text-indigo-300' : 'hover:bg-indigo-500/5'}`}>
        <Library className="size-5 text-indigo-500" /> All notes <span className="ml-auto rounded-full bg-zinc-500/10 px-2 text-sm tabular-nums text-zinc-500">{notes.length}</span>
      </Link>
      <div className="mt-5 mb-1.5 flex items-center justify-between px-2.5 text-[0.95rem] font-semibold text-zinc-600 dark:text-zinc-300">
        Folders
        <button title="New folder" className="rounded-lg p-1.5 text-indigo-500 transition hover:rotate-90 hover:bg-indigo-500/10" onClick={() => add()}><Plus className="size-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {folders.length === 0 && <button onClick={() => add()} className="w-full rounded-lg border border-dashed border-indigo-300 px-3 py-4 text-sm text-indigo-500 transition hover:bg-indigo-500/5 dark:border-indigo-500/30"><span className="inline-flex items-center gap-2"><FolderPlus className="size-5" /> Create your first folder</span></button>}
        {tree('', 0)}
      </div>

      <PromptDialog open={dialog?.kind === 'create'} onClose={close} icon={<FolderIcon className="size-5" />} submitLabel="Create folder" label="Folder name"
        title={dialog?.kind === 'create' && dialog.parent ? 'New subfolder' : 'New folder'}
        description={dialog?.kind === 'create' && dialog.parent ? <>Inside <b>{folderPath(dialog.parent, folders)}</b></> : 'Group notes by project, topic or anything you like.'}
        onSubmit={doCreate} />
      <PromptDialog open={dialog?.kind === 'rename'} onClose={close} icon={<Pencil className="size-5" />} submitLabel="Rename" label="New name"
        title="Rename folder" initial={dialog?.kind === 'rename' ? dialog.folder.name : ''} onSubmit={doRename} />
      <ConfirmDialog open={dialog?.kind === 'delete'} onClose={close} confirmLabel="Delete folder" onConfirm={doDelete}
        title={dialog?.kind === 'delete' ? `Delete “${dialog.folder.name}”?` : ''}
        description="Notes and subfolders inside it won’t be deleted — they move up one level." />
    </nav>
  )
}
