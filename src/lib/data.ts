import { ID, Permission, Query, Role, type Models } from 'appwrite'
import { BUCKET_ID, DB_ID, FOLDERS, NOTES, storage, tables } from './appwrite'

export type Block =
  | { id: string; type: 'text'; content: string }
  | { id: string; type: 'code'; lang: string; content: string }
  | { id: string; type: 'image'; fileId: string; caption: string }

export type Folder = Models.Row & { name: string; parentId: string; userId: string }
export type NoteRow = Models.Row & {
  title: string
  folderId: string
  userId: string
  blocks: string
  searchText: string
  isPublic: boolean
}
export type Note = Omit<NoteRow, 'blocks'> & { blocks: Block[] }

const owner = (userId: string) => [
  Permission.read(Role.user(userId)),
  Permission.update(Role.user(userId)),
  Permission.delete(Role.user(userId)),
]
const withPublic = (userId: string, isPublic: boolean) =>
  isPublic ? [...owner(userId), Permission.read(Role.any())] : owner(userId)

export const newBlockId = () => Math.random().toString(36).slice(2, 10)

const parse = (row: NoteRow): Note => {
  let blocks: Block[] = []
  try { blocks = JSON.parse(row.blocks || '[]') } catch { /* corrupted */ }
  return { ...row, blocks }
}

// ---------- folders ----------
export async function listFolders(userId: string) {
  const res = await tables.listRows<Folder>({
    databaseId: DB_ID, tableId: FOLDERS,
    queries: [Query.equal('userId', userId), Query.orderAsc('name'), Query.limit(500)],
  })
  return res.rows
}

export function createFolder(userId: string, name: string, parentId = '') {
  return tables.createRow<Folder>({
    databaseId: DB_ID, tableId: FOLDERS, rowId: ID.unique(),
    data: { name, parentId, userId }, permissions: owner(userId),
  })
}

export function renameFolder(id: string, name: string) {
  return tables.updateRow<Folder>({ databaseId: DB_ID, tableId: FOLDERS, rowId: id, data: { name } })
}

/** Deletes a folder; its notes and subfolders move up to its parent. */
export async function deleteFolder(folder: Folder, folders: Folder[], notes: Note[]) {
  await Promise.all([
    ...folders.filter(f => f.parentId === folder.$id).map(f =>
      tables.updateRow({ databaseId: DB_ID, tableId: FOLDERS, rowId: f.$id, data: { parentId: folder.parentId } })),
    ...notes.filter(n => n.folderId === folder.$id).map(n =>
      tables.updateRow({ databaseId: DB_ID, tableId: NOTES, rowId: n.$id, data: { folderId: folder.parentId } })),
  ])
  await tables.deleteRow({ databaseId: DB_ID, tableId: FOLDERS, rowId: folder.$id })
}

// ---------- notes ----------
export async function listNotes(userId: string) {
  const res = await tables.listRows<NoteRow>({
    databaseId: DB_ID, tableId: NOTES,
    queries: [Query.equal('userId', userId), Query.orderDesc('$updatedAt'), Query.limit(1000)],
  })
  return res.rows.map(parse)
}

export async function getNote(id: string) {
  return parse(await tables.getRow<NoteRow>({ databaseId: DB_ID, tableId: NOTES, rowId: id }))
}

const searchTextOf = (title: string, blocks: Block[]) =>
  [title, ...blocks.map(b => (b.type === 'image' ? b.caption : b.content))].join('\n').toLowerCase()

export async function saveNote(
  userId: string,
  note: { id?: string; title: string; folderId: string; blocks: Block[]; isPublic: boolean },
) {
  const data = {
    title: note.title || 'Untitled',
    folderId: note.folderId,
    userId,
    blocks: JSON.stringify(note.blocks),
    searchText: searchTextOf(note.title, note.blocks),
    isPublic: note.isPublic,
  }
  const permissions = withPublic(userId, note.isPublic)
  const row = note.id
    ? await tables.updateRow<NoteRow>({ databaseId: DB_ID, tableId: NOTES, rowId: note.id, data, permissions })
    : await tables.createRow<NoteRow>({ databaseId: DB_ID, tableId: NOTES, rowId: ID.unique(), data, permissions })
  // Keep image visibility in sync with the note's share state
  await Promise.all(note.blocks.filter(b => b.type === 'image').map(b =>
    storage.updateFile({ bucketId: BUCKET_ID, fileId: (b as { fileId: string }).fileId, permissions })
      .catch(() => undefined)))
  return parse(row)
}

export async function deleteNote(note: Note) {
  await Promise.all(note.blocks.filter(b => b.type === 'image').map(b =>
    storage.deleteFile({ bucketId: BUCKET_ID, fileId: (b as { fileId: string }).fileId }).catch(() => undefined)))
  await tables.deleteRow({ databaseId: DB_ID, tableId: NOTES, rowId: note.$id })
}

// ---------- images ----------
const MAX_EDGE = 2400
const COMPRESSIBLE = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp']

/**
 * Shrinks photos/screenshots before upload: applies EXIF rotation (so portrait photos
 * stay portrait), caps the longest edge at 2400px and re-encodes as WebP.
 * Keeps the original if it isn't smaller. GIF/SVG are left untouched.
 */
export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE.includes(file.type) || file.size < 150_000) return file
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/webp', 0.85))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' })
  } catch {
    return file
  }
}

export async function uploadImage(userId: string, original: File) {
  const file = await compressImage(original)
  const f = await storage.createFile({ bucketId: BUCKET_ID, fileId: ID.unique(), file, permissions: owner(userId) })
  return f.$id
}

export const imageUrl = (fileId: string) => storage.getFileView({ bucketId: BUCKET_ID, fileId })

// ---------- export ----------
export function toMarkdown(note: { title: string; blocks: Block[] }) {
  const parts = [`# ${note.title || 'Untitled'}`]
  for (const b of note.blocks) {
    if (b.type === 'text') parts.push(b.content)
    else if (b.type === 'code') parts.push('```' + b.lang + '\n' + b.content + '\n```')
    else parts.push(`![${b.caption.split('\n')[0] || 'image'}](${imageUrl(b.fileId)})` + (b.caption ? `\n\n${b.caption}` : ''))
  }
  return parts.join('\n\n') + '\n'
}

export function downloadMarkdown(note: { title: string; blocks: Block[] }) {
  const blob = new Blob([toMarkdown(note)], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = (note.title || 'note').replace(/[^\w.-]+/g, '_') + '.md'
  a.click()
  URL.revokeObjectURL(a.href)
}
