import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'

interface UserData {
  id: number
  email: string
  role: string
  status: string
  plan: string
  kyc_status: string
  applicant_id: string | null
  liveness_status: string | null
  created_at: string
  last_login: string | null
  kyc_updated_at: string | null
}

export default function UserEdit() {
  const { userId } = useParams()
  const navigate = useNavigate()
  
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [formData, setFormData] = useState({
    status: '',
    plan: '',
    role: ''
  })

  useEffect(() => {
    loadUser()
  }, [userId])

  const loadUser = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/admin/users/${userId}`)
      const userData = response.data.user
      setUser(userData)
      setFormData({
        status: userData.status,
        plan: userData.plan,
        role: userData.role
      })
      setError('')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar usuário')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      
      await api.put(`/admin/users/${userId}`, formData)
      
      setSuccess('Usuário atualizado com sucesso!')
      loadUser() // Recarregar dados
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar usuário')
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    if (!confirm('Tem certeza que deseja resetar a senha deste usuário? Uma senha temporária será enviada por email.')) {
      return
    }
    
    try {
      setResetting(true)
      setError('')
      setSuccess('')
      
      const response = await api.post(`/admin/users/${userId}/reset-password`)
      
      setSuccess(`Senha resetada! Senha temporária: ${response.data.temp_password}`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao resetar senha')
    } finally {
      setResetting(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Não disponível'
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando usuário...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Usuário não encontrado
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin/users')}
          className="text-blue-600 hover:text-blue-800 mb-4 flex items-center"
        >
          ← Voltar para lista
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Editar Usuário</h1>
        <p className="text-gray-600">{user.email}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Formulário de Edição */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Informações do Usuário</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">O email não pode ser alterado</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plano
                </label>
                <select
                  value={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="free">Free</option>
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">Usuário</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Apenas superadmin pode alterar roles
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
                
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resetting}
                  className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {resetting ? 'Resetando...' : 'Resetar Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Informações Adicionais */}
        <div className="space-y-6">
          {/* Informações de KYC */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">KYC</h3>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-500">Status KYC</div>
                <div className="text-sm font-medium text-gray-900">{user.kyc_status}</div>
              </div>
              {user.applicant_id && (
                <div>
                  <div className="text-sm text-gray-500">Applicant ID</div>
                  <div className="text-sm font-medium text-gray-900 break-all">{user.applicant_id}</div>
                </div>
              )}
              {user.liveness_status && (
                <div>
                  <div className="text-sm text-gray-500">Liveness</div>
                  <div className="text-sm font-medium text-gray-900">{user.liveness_status}</div>
                </div>
              )}
              {user.kyc_updated_at && (
                <div>
                  <div className="text-sm text-gray-500">Atualizado em</div>
                  <div className="text-sm font-medium text-gray-900">{formatDate(user.kyc_updated_at)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Informações de Conta */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Conta</h3>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-500">ID</div>
                <div className="text-sm font-medium text-gray-900">{user.id}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Criado em</div>
                <div className="text-sm font-medium text-gray-900">{formatDate(user.created_at)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Último Login</div>
                <div className="text-sm font-medium text-gray-900">{formatDate(user.last_login)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

