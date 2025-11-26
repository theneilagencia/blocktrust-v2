import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Card from '../components/Card'
import Button from '../components/Button'
import { showToast } from '../components/Toaster'
import api from '../lib/api'

export default function Admin() {
  const [users, setUsers] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAdminData()
  }, [])

  const loadAdminData = async () => {
    try {
      // Aqui você faria as chamadas reais para a API
      // Por enquanto, dados mockados
      setUsers([
        { id: 1, email: 'user@example.com', role: 'user', created_at: '2024-01-15' },
      ])
      setLogs([
        { id: 1, user_id: 1, action: 'login', ip: '192.168.1.1', created_at: '2024-01-15T10:30:00Z' },
      ])
      setAlerts([])
    } catch (error) {
      showToast('error', 'Erro ao carregar dados administrativos')
    } finally {
      setLoading(false)
    }
  }

  const exportCSV = (data: any[], filename: string) => {
    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    
    showToast('success', `${filename} exportado com sucesso!`)
  }

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600">Carregando...</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold mb-2">Painel Administrativo</h1>
          <p className="text-gray-600">Gestão de usuários, logs e alertas</p>
        </div>

        <Card title="Usuários">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">ID</th>
                  <th className="text-left py-2">Email</th>
                  <th className="text-left py-2">Role</th>
                  <th className="text-left py-2">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b">
                    <td className="py-2">{user.id}</td>
                    <td className="py-2">{user.email}</td>
                    <td className="py-2">{user.role}</td>
                    <td className="py-2">{new Date(user.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={() => exportCSV(users, 'usuarios.csv')} className="mt-4">
            Exportar CSV
          </Button>
        </Card>

        <Card title="Logs de Acesso">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">ID</th>
                  <th className="text-left py-2">Usuário</th>
                  <th className="text-left py-2">Ação</th>
                  <th className="text-left py-2">IP</th>
                  <th className="text-left py-2">Data/Hora</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b">
                    <td className="py-2">{log.id}</td>
                    <td className="py-2">{log.user_id}</td>
                    <td className="py-2">{log.action}</td>
                    <td className="py-2">{log.ip}</td>
                    <td className="py-2">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={() => exportCSV(logs, 'logs.csv')} className="mt-4">
            Exportar CSV
          </Button>
        </Card>

        <Card title="Alertas de Pânico">
          {alerts.length === 0 ? (
            <p className="text-gray-600 text-center py-8">Nenhum alerta registrado</p>
          ) : (
            <div className="space-y-4">
              {alerts.map(alert => (
                <div key={alert.id} className="border-b pb-4">
                  <p className="font-medium">Usuário: {alert.user_id}</p>
                  <p className="text-sm text-gray-600">Wallet: {alert.wallet}</p>
                  <p className="text-sm text-gray-600">Hash: {alert.hash}</p>
                  <p className="text-sm text-gray-600">Nota: {alert.note}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(alert.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  )
}

