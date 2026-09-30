import { Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

type Props = {
  open: boolean
  title: string
  icon?: ReactNode
  description?: ReactNode
  onClose: () => void
  children: ReactNode
}

export function Dialog({ open, title, icon, description, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="animate-fade-in absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title}
        className="animate-pop-in relative w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl shadow-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-start gap-3">
          {icon && <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-lg text-white shadow-lg shadow-indigo-500/30">{icon}</div>}
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-zinc-500">{description}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

type PromptProps = {
  open: boolean
  title: string
  description?: ReactNode
  icon?: ReactNode
  label: string
  initial?: string
  submitLabel: string
  onSubmit: (value: string) => Promise<void> | void
  onClose: () => void
}

export function PromptDialog({ open, title, description, icon, label, initial = '', submitLabel, onSubmit, onClose }: PromptProps) {
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setValue(initial) }, [open, initial])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    setBusy(true)
    try { await onSubmit(value.trim()); onClose() } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} title={title} description={description} icon={icon} onClose={onClose}>
      <form onSubmit={submit}>
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">{label}</label>
        <input autoFocus className="input" value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. Project Alpha" maxLength={256} />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || !value.trim()}>{busy ? 'Saving…' : submitLabel}</button>
        </div>
      </form>
    </Dialog>
  )
}

type ConfirmProps = {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => Promise<void> | void
  onClose: () => void
}

export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onClose }: ConfirmProps) {
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    setBusy(true)
    try { await onConfirm(); onClose() } finally { setBusy(false) }
  }
  return (
    <Dialog open={open} title={title} description={description} icon={<Trash2 className="size-5" />} onClose={onClose}>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button autoFocus className="btn bg-red-600 text-white hover:bg-red-500" disabled={busy} onClick={confirm}>
          {busy ? 'Deleting…' : confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
