import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, logoutAdmin, adminFetch, isAuthenticated, isSuperadmin } from '../../utils/adminAuth';
// import { Button } from '../../components/Button';

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication
    if (!isAuthenticated() || !isSuperadmin()) {
      navigate('/admin/login');
      return;
    }

    setUser(getUser());
    loadData();
  }, [navigate]);

  const loadData = async () => {
    try {
      const [healthData, auditData] = await Promise.all([
        adminFetch('/api/admin/health'),
        adminFetch('/api/admin/audit?limit=10')
      ]);

      setHealth(healthData.health);
      setAuditLogs(auditData.logs);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutAdmin();
    navigate('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-400 text-sm">Bem-vindo, {user?.name}</p>
          </div>
          <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold">
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <h3 className="text-gray-400 text-sm mb-2">Total de Usuários</h3>
            <p className="text-3xl font-bold">{health?.statistics?.total_users || 0}</p>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <h3 className="text-gray-400 text-sm mb-2">KYC Aprovados</h3>
            <p className="text-3xl font-bold">{health?.statistics?.approved_kyc || 0}</p>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <h3 className="text-gray-400 text-sm mb-2">Atividade (24h)</h3>
            <p className="text-3xl font-bold">{health?.statistics?.activity_24h || 0}</p>
          </div>
        </div>

        {/* Audit Logs */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-bold mb-4">Logs de Auditoria</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="pb-3">Data/Hora</th>
                  <th className="pb-3">Usuário</th>
                  <th className="pb-3">Ação</th>
                  <th className="pb-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-800">
                    <td className="py-3 text-sm">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 text-sm">{log.email || 'N/A'}</td>
                    <td className="py-3 text-sm">
                      <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-400">{log.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

