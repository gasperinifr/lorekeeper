import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl text-gold text-center mb-2">Lorekeeper</h1>
        <p className="text-parchment/50 text-sm text-center mb-8">O cérebro da sua campanha.</p>

        <form onSubmit={onSubmit} className="bg-stone-100 border border-stone-300 rounded-lg p-6 flex flex-col gap-4">
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <Input label="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p className="text-xs text-crimson-light">{error}</p>}
          <Button type="submit" loading={loading} size="lg" className="mt-1 w-full">Entrar</Button>
        </form>

        <p className="text-center text-sm text-parchment/40 mt-4">
          Não tem conta?{' '}
          <Link to="/register" className="text-gold hover:underline">Criar conta</Link>
        </p>
      </div>
    </div>
  )
}