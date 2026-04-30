import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await register(form.username, form.email, form.password)
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
        <p className="text-parchment/50 text-sm text-center mb-8">Crie sua conta de Mestre.</p>

        <form onSubmit={onSubmit} className="bg-stone-100 border border-stone-300 rounded-lg p-6 flex flex-col gap-4">
          <Input label="Username" value={form.username} onChange={set('username')} required minLength={3} />
          <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
          <Input label="Senha" type="password" value={form.password} onChange={set('password')} required minLength={8} />
          {error && <p className="text-xs text-crimson-light">{error}</p>}
          <Button type="submit" loading={loading} size="lg" className="mt-1 w-full">Criar conta</Button>
        </form>

        <p className="text-center text-sm text-parchment/40 mt-4">
          Já tem conta?{' '}
          <Link to="/login" className="text-gold hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  )
}