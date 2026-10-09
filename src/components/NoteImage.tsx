import { useEffect, useState, type ImgHTMLAttributes } from 'react'
import { ImageOff } from 'lucide-react'
import { imageUrl } from '../lib/data'

/*
 * A plain <img src> can't authenticate: Appwrite keeps the session in localStorage
 * ("cookieFallback") when third-party cookies are blocked, and only sends it as the
 * X-Fallback-Cookies header. So private images are fetched with that header and shown
 * via an object URL. Cached per file so re-renders don't refetch.
 */
const cache = new Map<string, Promise<string>>()

/** Fetches a (possibly private) image file as a Blob. */
export async function fetchImageBlob(fileId: string): Promise<Blob> {
  const headers: Record<string, string> = {}
  try {
    const fallback = localStorage.getItem('cookieFallback')
    if (fallback) headers['X-Fallback-Cookies'] = fallback
  } catch { /* storage unavailable */ }
  const res = await fetch(imageUrl(fileId), { headers, credentials: 'include' })
  if (!res.ok) throw new Error(`Image failed to load (${res.status})`)
  return res.blob()
}

function loadImage(fileId: string): Promise<string> {
  let p = cache.get(fileId)
  if (!p) {
    p = fetchImageBlob(fileId).then(blob => URL.createObjectURL(blob))
    p.catch(() => cache.delete(fileId))
    cache.set(fileId, p)
  }
  return p
}

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { fileId: string }

export function NoteImage({ fileId, className, alt = '', ...rest }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setFailed(false)
    loadImage(fileId).then(url => alive && setSrc(url), () => alive && setFailed(true))
    return () => { alive = false }
  }, [fileId])

  if (failed) {
    return (
      <div className={`grid min-h-40 place-items-center rounded-lg border border-dashed border-zinc-300 text-zinc-500 dark:border-zinc-700 ${className ?? ''}`}>
        <span className="flex items-center gap-2 text-sm"><ImageOff className="size-5" /> Couldn’t load this image</span>
      </div>
    )
  }
  if (!src) return <div className={`min-h-40 animate-pulse rounded-lg bg-zinc-200/60 dark:bg-zinc-800/50 ${className ?? ''}`} />
  return <img src={src} alt={alt} className={className} {...rest} />
}

/** Opens the full-size image in a new tab (works for private files too). */
export async function openImage(fileId: string) {
  const win = window.open('', '_blank')
  try {
    const url = await loadImage(fileId)
    if (win) win.location.href = url
  } catch {
    win?.close()
  }
}
