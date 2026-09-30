import { Moon, Sun } from 'lucide-react'
import { useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch { /* ignore */ }
    setDark(next)
  }
  return (
    <button className="btn-ghost" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
      {dark ? <Sun className="size-5 text-amber-400" /> : <Moon className="size-5 text-indigo-500" />}
    </button>
  )
}
