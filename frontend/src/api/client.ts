const BASE = '/api'

function getToken() {
  return localStorage.getItem('lk_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> ?? {}) }
  if (options.body) headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem('lk_token')
    window.location.href = '/login'
    throw new Error('Sessão expirada.')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido.' }))
    throw new Error(err.error ?? `Erro ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get:    <T>(path: string) => request<T>(path),
  post:   <T>(path: string, body: unknown) => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: <T>(path: string)               => request<T>(path, { method: 'DELETE' }),
}
