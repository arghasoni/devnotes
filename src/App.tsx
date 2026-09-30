import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { AuthPage } from './pages/AuthPage'
import { Layout } from './pages/Layout'
import { NoteList } from './pages/NoteList'
import { NoteEdit, NoteView, SharedNote } from './pages/NotePages'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/s/:id" element={<SharedNote />} />
          <Route element={<Layout />}>
            <Route index element={<NoteList />} />
            <Route path="new" element={<NoteEdit />} />
            <Route path="note/:id" element={<NoteView />} />
            <Route path="note/:id/edit" element={<NoteEdit />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
