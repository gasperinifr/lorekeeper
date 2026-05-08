import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from '@/api/client'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
}

interface AuthActions {
  login:    (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  updateUsername: (username: string) => Promise<void>
  logout:   () => void
}

const AuthContext = createContext<(AuthState & AuthActions) | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('lk_token'),
    loading: true,
  })

  // Valida token salvo ao montar
  useEffect(() => {
    if (!state.token) { setState(s => ({ ...s, loading: false })); return }
    api.get<User>('/auth/me')
      .then(user => setState(s => ({ ...s, user, loading: false })))
      .catch(() => {
        localStorage.removeItem('lk_token')
        setState({ user: null, token: null, loading: false })
      })
  }, [])

  const setAuth = (user: User, token: string) => {
    localStorage.setItem('lk_token', token)
    setState({ user, token, loading: false })
  }

  const login = async (email: string, password: string) => {
    const { user, token } = await api.post<{ user: User; token: string }>('/auth/login', { email, password })
    setAuth(user, token)
  }

  const register = async (username: string, email: string, password: string) => {
    const { user, token } = await api.post<{ user: User; token: string }>('/auth/register', { username, email, password })
    setAuth(user, token)
  }

  const updateUsername = async (username: string) => {
    const { user, token } = await api.patch<{ user: User; token: string }>('/auth/me', { username })
    setAuth(user, token)
  }

  const logout = () => {
    localStorage.removeItem('lk_token')
    setState({ user: null, token: null, loading: false })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, register, updateUsername, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
