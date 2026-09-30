import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ID, type Models } from 'appwrite'
import { account } from './appwrite'

type User = Models.User<Models.Preferences>
type AuthCtx = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null!)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    account.get().then(setUser, () => setUser(null)).finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    await account.createEmailPasswordSession({ email, password })
    setUser(await account.get())
  }
  const signup = async (name: string, email: string, password: string) => {
    await account.create({ userId: ID.unique(), email, password, name })
    await login(email, password)
  }
  const logout = async () => {
    await account.deleteSession({ sessionId: 'current' })
    setUser(null)
  }

  return <Ctx.Provider value={{ user, loading, login, signup, logout }}>{children}</Ctx.Provider>
}
