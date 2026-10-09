import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

const isDark = () => document.documentElement.classList.contains('dark')

/** Flips the theme from anywhere (toggle button, command palette). */
export function toggleTheme() {
  const next = !isDark()
  document.documentElement.classList.toggle('dark', next)
  try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch { /* ignore */ }
  window.dispatchEvent(new Event('theme-change'))
}

export function ThemeToggle() {
  const [dark, setDark] = useState(isDark)
  useEffect(() => {
    const h = () => setDark(isDark())
    window.addEventListener('theme-change', h)
    return () => window.removeEventListener('theme-change', h)
  }, [])
  return (
    <button className="btn-ghost" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
      {dark ? <Sun className="size-5 text-amber-400" /> : <Moon className="size-5 text-indigo-500" />}
    </button>
  )
}
