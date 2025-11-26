import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Explorer() {
  const [token, setToken] = useState(localStorage.getItem('jwt_explorer') || '');
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [contracts, setContracts] = useState(null);
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login
  const handleLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post('/api/explorer/login', form);
      const newToken = response.data.token;
      
      localStorage.setItem('jwt_explorer', newToken);
      setToken(newToken);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro no login');
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('jwt_explorer');
    setToken('');
    setEvents([]);
    setStats(null);
  };

  // Carregar eventos
  const loadEvents = async () => {
    try {
      const response = await axios.get('/api/explorer/events', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEvents(response.data.events);
    } catch (err) {
      console.error('Erro ao carregar eventos:', err);
      if (err.response?.status === 401) {
        handleLogout();
      }
    }
  };

  // Carregar estatísticas
  const loadStats = async () => {
    try {
      const response = await axios.get('/api/explorer/stats');
      setStats(response.data.stats);
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    }
  };

  // Carregar contratos
  const loadContracts = async () => {
    try {
      const response = await axios.get('/api/explorer/contracts');
      setContracts(response.data.contracts);
    } catch (err) {
      console.error('Contratos não deployados:', err);
    }
  };

  // Auto-refresh a cada 15 segundos
  useEffect(() => {
    if (token) {
      loadEvents();
      loadStats();
      loadContracts();
      
      const interval = setInterval(() => {
        loadEvents();
        loadStats();
      }, 15000);
      
      return () => clearInterval(interval);
    }
  }, [token]);

  // Tela de login
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
          <h1 className="text-3xl font-bold mb-6 text-center">🔐 Blocktrust Explorer</h1>
          
          {error && (
            <div className="bg-red-600 text-white p-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <input
            className="w-full p-3 mb-4 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          />
          
          <input
            className="w-full p-3 mb-6 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          />
          
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Login'}
          </button>
          
          <p className="text-gray-400 text-sm mt-4 text-center">
            Credenciais padrão: admin@bts.com / 123
          </p>
        </div>
      </div>
    );
  }

  // Painel principal
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">📊 Blocktrust Explorer</h1>
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition"
        >
          Logout
        </button>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Total de Eventos</p>
            <p className="text-2xl font-bold">{stats.total_events}</p>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Últimas 24h</p>
            <p className="text-2xl font-bold">{stats.events_24h}</p>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Tipos de Eventos</p>
            <p className="text-2xl font-bold">{Object.keys(stats.events_by_type || {}).length}</p>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Último Evento</p>
            <p className="text-sm font-mono">
              {stats.last_event ? stats.last_event.type : 'N/A'}
            </p>
          </div>
        </div>
      )}

      {/* Contratos */}
      {contracts && (
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <h2 className="text-xl font-bold mb-3">📜 Smart Contracts</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(contracts).map(([name, address]) => (
              <div key={name} className="bg-gray-700 p-3 rounded">
                <p className="text-gray-400 text-sm">{name}</p>
                <p className="text-xs font-mono break-all">{address}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela de Eventos */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold">🔔 Eventos da Blockchain</h2>
          <span className="text-sm text-gray-400">
            Auto-refresh a cada 15s
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Dados</th>
                <th className="px-4 py-3 text-left">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-4 py-8 text-center text-gray-400">
                    Nenhum evento encontrado
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="border-b border-gray-700 hover:bg-gray-750">
                    <td className="px-4 py-3 font-mono text-sm">{event.id}</td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                        {event.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <details className="cursor-pointer">
                        <summary className="text-sm text-gray-400">Ver dados</summary>
                        <pre className="text-xs mt-2 bg-gray-900 p-2 rounded overflow-x-auto">
                          {JSON.stringify(event.data, null, 2)}
                        </pre>
                      </details>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(event.timestamp).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

