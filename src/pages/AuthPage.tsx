import { Code2, Eye, EyeOff, FolderTree, ImagePlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ThemeToggle } from '../lib/theme'
import { Backdrop } from '../components/Backdrop'

const FEATURES = [
  { icon: <Code2 className="size-5" />, text: 'Save commands & code with one-click copy' },
  { icon: <ImagePlus className="size-5" />, text: 'Paste screenshots and annotate them' },
  { icon: <FolderTree className="size-5" />, text: 'Organise every project in nested folders' },
]

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { user, login, signup } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signup') await signup(name, email, password)
      else await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative isolate flex min-h-screen flex-col">
      <Backdrop />
      <div className="flex justify-end p-4"><ThemeToggle /></div>
      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 px-4 pb-16 md:grid-cols-2">
        <div className="hidden md:block">
          <img src="/logo.png" alt="DevNotes logo" className="animate-float mb-6 h-28 w-28 drop-shadow-2xl" />
          <h1 className="animate-slide-up text-5xl leading-tight font-extrabold tracking-tight">
            Every fix,<br /><span className="text-gradient animate-gradient">remembered.</span>
          </h1>
          <p className="animate-slide-up mt-4 max-w-sm text-zinc-500 [animation-delay:80ms]">
            A blog-style notebook for the commands, screenshots and solutions you find while building.
          </p>
          <ul className="mt-8 space-y-3">
            {FEATURES.map((f, i) => (
              <li key={f.text} className="animate-slide-up flex items-center gap-3 text-base" style={{ animationDelay: `${160 + i * 90}ms` }}>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">{f.icon}</span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={submit}
          className="animate-pop-in mx-auto w-full max-w-sm space-y-4 rounded-2xl border border-white/60 bg-white/70 p-8 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="mb-6 text-center">
            <img src="/logo.png" alt="" className="animate-float mx-auto mb-3 h-14 w-14 md:hidden" />
            <h2 className="text-2xl font-bold">{mode === 'login' ? 'Welcome back 👋' : 'Create your account'}</h2>
            <p className="mt-1 text-sm text-zinc-500">{mode === 'login' ? 'Sign in to your DevNotes' : 'Start keeping your dev notes in one place'}</p>
          </div>
          {mode === 'signup' && <input className="input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />}
          <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          <div className="relative">
            <input className="input pr-12" type={showPassword ? 'text' : 'password'} placeholder="Password (min 8 characters)" minLength={8}
              value={password} onChange={e => setPassword(e.target.value)} required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            <button type="button" onClick={() => setShowPassword(s => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}
              className="absolute inset-y-0 right-1 my-1 rounded-md px-2 text-xs font-medium text-zinc-500 transition hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-300">
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
          {error && <p className="animate-fade-in rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button className="btn-primary w-full justify-center py-2.5" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Sign up'}
          </button>
          <p className="text-center text-sm text-zinc-500">
            {mode === 'login'
              ? <>No account? <Link className="font-medium text-indigo-600 hover:underline dark:text-indigo-400" to="/signup">Sign up</Link></>
              : <>Already have an account? <Link className="font-medium text-indigo-600 hover:underline dark:text-indigo-400" to="/login">Sign in</Link></>}
          </p>
        </form>
      </div>
    </div>
  )
}
