import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Home from './app/Home'
import Login from './app/Login'
import Register from './app/Register'
import Dashboard from './app/Dashboard'
import RegisterDoc from './app/RegisterDoc'
import VerifyDoc from './app/VerifyDoc'
import SignDocument from './app/SignDocument'
import MyIdentity from './app/MyIdentity'
import Admin from './app/Admin'
import { KYCVerification } from './app/KYCVerification'
import AdminLogin from './app/admin/AdminLogin'
import AdminDashboard from './app/admin/AdminDashboard'
import UserList from './app/admin/UserList'
import UserEdit from './app/admin/UserEdit'
import { AuthProvider, useAuth } from './lib/auth'
import { PrivyProvider } from './providers/PrivyProvider'
import Toaster from './components/Toaster'
import Explorer from './components/Explorer'
import DualSignature from './components/DualSignature'
import api from './lib/api'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return user ? <>{children}</> : <Navigate to="/login" />
}

function KycRequiredRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [kycApproved, setKycApproved] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) return

    const checkKycStatus = async () => {
      try {
        const response = await api.get('/kyc/status')
        const status = response.data.status
        if (status === 'approved' || status === 'APPROVED') {
          setKycApproved(true)
        } else {
          setKycApproved(false)
          navigate('/kyc', { replace: true })
        }
      } catch (error) {
        setKycApproved(false)
        navigate('/kyc', { replace: true })
      }
    }

    checkKycStatus()
  }, [user, navigate])

  if (!user) return <Navigate to="/login" />
  if (kycApproved === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Verificando status...</p>
      </div>
    )
  }
  return kycApproved ? <>{children}</> : null
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return user && (user.role === 'admin' || user.role === 'superadmin') ? <>{children}</> : <Navigate to="/dashboard" />
}

function App() {
  return (
    <PrivyProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<PrivateRoute><KycRequiredRoute><Dashboard /></KycRequiredRoute></PrivateRoute>} />
            <Route path="/registrar" element={<PrivateRoute><KycRequiredRoute><RegisterDoc /></KycRequiredRoute></PrivateRoute>} />
            <Route path="/assinar" element={<PrivateRoute><KycRequiredRoute><SignDocument /></KycRequiredRoute></PrivateRoute>} />
            <Route path="/verificar" element={<PrivateRoute><VerifyDoc /></PrivateRoute>} />
            <Route path="/identidade" element={<PrivateRoute><MyIdentity /></PrivateRoute>} />
            <Route path="/kyc" element={<PrivateRoute><KYCVerification /></PrivateRoute>} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminRoute><UserList /></AdminRoute>} />
            <Route path="/admin/users/:userId" element={<AdminRoute><UserEdit /></AdminRoute>} />
            <Route path="/explorer" element={<Explorer />} />
            <Route path="/dual-signature" element={<PrivateRoute><DualSignature /></PrivateRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </PrivyProvider>
  )
}

export default App
