import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Shield } from 'lucide-react'
import Button from '../components/Button'
import Input from '../components/Input'
import Card from '../components/Card'
import { showToast } from '../components/Toaster'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [coercionPassword, setCoercionPassword] = useState('')
  const [confirmCoercionPassword, setConfirmCoercionPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      showToast('error', 'As senhas normais não coincidem')
      return
    }

    if (coercionPassword !== confirmCoercionPassword) {
      showToast('error', 'As senhas de coação não coincidem')
      return
    }

    if (password.length < 8) {
      showToast('error', 'A senha normal deve ter no mínimo 8 caracteres')
      return
    }

    if (coercionPassword.length < 8) {
      showToast('error', 'A senha de coação deve ter no mínimo 8 caracteres')
      return
    }

    if (password === coercionPassword) {
      showToast('error', 'A senha de coação deve ser diferente da senha normal')
      return
    }

    setLoading(true)

    try {
      await register(email, password, coercionPassword)
      showToast('success', 'Conta criada com sucesso!')
      navigate('/dashboard')
    } catch (error: any) {
      showToast('error', error.response?.data?.error || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy to-brand-neutral flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo-black.png" alt="BTS Blocktrust" className="h-16 mx-auto mb-4" />
          <p className="text-gray-600">Crie sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
          />

          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <Input
            label="Confirmar Senha"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <div className="border-t border-gray-200 pt-4 mt-6">
            <p className="text-sm text-gray-600 mb-3">
              <strong>🚨 Senha de Coação (Emergência)</strong><br />
              Use esta senha em situações de emergência. Ela cancelará seu NFT automaticamente.
            </p>
            
            <Input
              label="Senha de Coação"
              type="password"
              value={coercionPassword}
              onChange={(e) => setCoercionPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <Input
              label="Confirmar Senha de Coação"
              type="password"
              value={confirmCoercionPassword}
              onChange={(e) => setConfirmCoercionPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="mt-3"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </Button>
        </form>

        <p className="text-center text-gray-600 mt-6">
          Já tem uma conta?{' '}
          <Link to="/login" className="text-brand-blue font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  )
}

