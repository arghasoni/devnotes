import { strToU8, zip, type Zippable } from 'fflate'
import { fetchImageBlob } from '../components/NoteImage'
import { imageIds, toMarkdown, type Folder, type Note } from './data'

// eslint-disable-next-line no-control-regex -- strip control chars, which zip/OS file names reject
const safe = (s: string) => s.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_').replace(/^[\s.]+|[\s.]+$/g, '').slice(0, 80) || 'Untitled'
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/bmp': 'bmp' }

/**
 * Zips every note as Markdown, laid out in its folder path, with images next to it in
 * an images/ subfolder (linked relatively, so the export reads fine offline).
 */
export async function exportAll(notes: Note[], folders: Folder[], onProgress: (msg: string) => void) {
  const dirOf = new Map<string, string>()
  const dir = (id: string, depth = 0): string => {
    if (!id || depth > 20) return ''
    let d = dirOf.get(id)
    if (d === undefined) {
      const f = folders.find(x => x.$id === id)
      d = f ? dir(f.parentId, depth + 1) + safe(f.name) + '/' : ''
      dirOf.set(id, d)
    }
    return d
  }

  const files: Zippable = {}
  for (const f of folders) files[dir(f.$id)] = {} // keep empty folders

  // Download every image once
  const ids = notes.flatMap(n => imageIds(n.blocks))
  const images = new Map<string, { data: Uint8Array; ext: string }>()
  const failed: string[] = []
  for (const [i, id] of ids.entries()) {
    onProgress(`Downloading images ${i + 1}/${ids.length}…`)
    try {
      const blob = await fetchImageBlob(id)
      images.set(id, { data: new Uint8Array(await blob.arrayBuffer()), ext: EXT[blob.type] ?? 'png' })
    } catch {
      failed.push(id)
    }
  }

  onProgress('Packing zip…')
  const used = new Set<string>()
  for (const n of notes) {
    const d = dir(n.folderId)
    let name = safe(n.title), k = 1
    while (used.has(d + name)) name = `${safe(n.title)} (${++k})`
    used.add(d + name)

    const src = (id: string) => (images.has(id) ? `images/${id}.${images.get(id)!.ext}` : `images/${id} (missing)`)
    const front = ['---', `title: ${JSON.stringify(n.title)}`, `created: ${n.$createdAt}`, `updated: ${n.$updatedAt}`, `public: ${n.isPublic}`, '---', ''].join('\n')
    files[d + name + '.md'] = strToU8(front + toMarkdown(n, src))
    for (const id of imageIds(n.blocks)) {
      const img = images.get(id)
      if (img) files[`${d}images/${id}.${img.ext}`] = [img.data, { level: 0 }] // already compressed
    }
  }
  if (failed.length) files['_export-errors.txt'] = strToU8(`These images could not be downloaded:\n${failed.join('\n')}\n`)

  const data = await new Promise<Uint8Array>((res, rej) => zip(files, (err, out) => (err ? rej(err) : res(out))))
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([data as BlobPart], { type: 'application/zip' }))
  a.download = `devnotes-backup-${new Date().toISOString().slice(0, 10)}.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  return { notes: notes.length, images: images.size, failed: failed.length }
}
