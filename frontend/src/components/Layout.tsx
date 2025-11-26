import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { LogOut, Home, FileText, CheckCircle, Shield } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-brand-navy text-white shadow-lg">
        <div className="container-custom">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center space-x-3">
              <img src="/logo.png" alt="BTS Blocktrust" className="h-8" />
            </Link>
            
            {user && (
              <div className="flex items-center space-x-6">
                <Link to="/dashboard" className="flex items-center space-x-2 hover:text-gray-300 transition">
                  <Home className="w-5 h-5" />
                  <span>Painel</span>
                </Link>
                <Link to="/registrar" className="flex items-center space-x-2 hover:text-gray-300 transition">
                  <FileText className="w-5 h-5" />
                  <span>Registrar</span>
                </Link>
                <Link to="/verificar" className="flex items-center space-x-2 hover:text-gray-300 transition">
                  <CheckCircle className="w-5 h-5" />
                  <span>Verificar</span>
                </Link>
                {user.role === 'admin' && (
                  <Link to="/admin" className="flex items-center space-x-2 hover:text-gray-300 transition">
                    <Shield className="w-5 h-5" />
                    <span>Admin</span>
                  </Link>
                )}
                <button onClick={handleLogout} className="flex items-center space-x-2 hover:text-gray-300 transition">
                  <LogOut className="w-5 h-5" />
                  <span>Sair</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      
      <main className="container-custom py-8">
        {children}
      </main>
      
      <footer className="bg-brand-neutral text-white py-6 mt-12">
        <div className="container-custom text-center">
          <p>2025 BTS Global Corp © Todos os direitos reservados</p>
          <p className="text-sm text-gray-400 mt-2">Sistema descentralizado de registro blockchain</p>
        </div>
      </footer>
    </div>
  )
}

