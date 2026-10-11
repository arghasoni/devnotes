import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { AuthPage } from './pages/AuthPage'
import { Layout } from './pages/Layout'
import { NoteList } from './pages/NoteList'

// Note pages pull in the editor, Markdown and syntax highlighting — load them on demand
const NoteEdit = lazy(() => import('./pages/NotePages').then(m => ({ default: m.NoteEdit })))
const NoteView = lazy(() => import('./pages/NotePages').then(m => ({ default: m.NoteView })))
const SharedNote = lazy(() => import('./pages/NotePages').then(m => ({ default: m.SharedNote })))

const page = (el: React.ReactNode) => <Suspense fallback={<div className="p-8 text-sm text-zinc-500">Loading…</div>}>{el}</Suspense>

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/s/:id" element={page(<SharedNote />)} />
          <Route element={<Layout />}>
            <Route index element={<NoteList />} />
            <Route path="new" element={page(<NoteEdit />)} />
            <Route path="note/:id" element={page(<NoteView />)} />
            <Route path="note/:id/edit" element={page(<NoteEdit />)} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
