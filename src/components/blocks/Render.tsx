import { Check, Copy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import { type Block } from '../../lib/data'
import { NoteImage, openImage } from '../NoteImage'

export function Markdown({ text }: { text: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text, { async: false, breaks: true }) as string), [text])
  return <div className="prose prose-lg prose-zinc dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}

export function CodeView({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false)
  const html = useMemo(() => {
    try {
      return lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : hljs.highlightAuto(code).value
    } catch { return code.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!) }
  }, [code, lang])
  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <div className="group relative my-4 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5 text-sm text-zinc-400">
        <span>{lang || 'code'}</span>
        <button onClick={copy} className="flex items-center gap-1.5 rounded px-2 py-0.5 hover:bg-zinc-800">{copied ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy</>}</button>
      </div>
      <pre className="overflow-x-auto p-4 text-[0.95rem] leading-relaxed"><code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /></pre>
    </div>
  )
}

export function ImageView({ fileId, caption }: { fileId: string; caption: string }) {
  return (
    <figure className="my-6">
      <button type="button" onClick={() => openImage(fileId)} className="block w-full cursor-zoom-in" title="Open full size">
        <NoteImage fileId={fileId} alt={caption.split('\n')[0]} className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800" />
      </button>
      {caption && <figcaption className="mt-2 border-l-2 border-indigo-300 pl-3 dark:border-zinc-700"><Markdown text={caption} /></figcaption>}
    </figure>
  )
}

export function BlocksView({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map(b =>
        b.type === 'text' ? <div key={b.id} className="my-4"><Markdown text={b.content} /></div>
        : b.type === 'code' ? <CodeView key={b.id} code={b.content} lang={b.lang} />
        : <ImageView key={b.id} fileId={b.fileId} caption={b.caption} />)}
    </>
  )
}
