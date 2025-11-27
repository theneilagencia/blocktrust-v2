import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Card from '../components/Card'
import Button from '../components/Button'
import StatusBadge from '../components/StatusBadge'
import { showToast } from '../components/Toaster'
import api from '../lib/api'
import { useNavigate } from 'react-router-dom'
import { Shield, Wallet, ExternalLink, Copy, CheckCircle, XCircle, Clock } from 'lucide-react'

interface IdentityData {
  wallet_address: string | null
  nft_token_id: string | null
  nft_tx_hash: string | null
  nft_active: boolean
  kyc_status: string
  email: string
}

export default function MyIdentity() {
  const [loading, setLoading] = useState(true)
  const [identity, setIdentity] = useState<IdentityData | null>(null)
  const navigate = useNavigate()

  const IDENTITY_NFT_ADDRESS = '0x2Fab210764165a229a17Cc3c759A1c80F206Ccb3'

  useEffect(() => {
    loadIdentityData()
  }, [])

  const loadIdentityData = async () => {
    try {
      const response = await api.get('/admin/me')
      setIdentity(response.data)
    } catch (error: any) {
      console.error('Erro ao carregar dados de identidade:', error)
      showToast('error', 'Erro ao carregar dados de identidade')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    showToast('success', `${label} copiado!`)
  }

  const getKycStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <StatusBadge status="success">Aprovado</StatusBadge>
      case 'pending':
        return <StatusBadge status="warning">Em Análise</StatusBadge>
      case 'rejected':
        return <StatusBadge status="error">Rejeitado</StatusBadge>
      default:
        return <StatusBadge status="default">Não Iniciado</StatusBadge>
    }
  }

  const getNftStatusBadge = (active: boolean) => {
    if (active) {
      return <StatusBadge status="success">Ativo</StatusBadge>
    }
    return <StatusBadge status="error">Inativo</StatusBadge>
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
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold mb-2">Minha Identidade Digital</h1>
          <p className="text-gray-600">
            Visualize seu token de identidade NFT e dados da carteira blockchain
          </p>
        </div>

        {/* Status do KYC */}
        <Card title="Status da Verificação (KYC)">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Shield className="w-8 h-8 text-brand-blue" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Status da Verificação</p>
                <div className="mt-1">
                  {identity && getKycStatusBadge(identity.kyc_status)}
                </div>
              </div>
            </div>
            {identity?.kyc_status !== 'approved' && (
              <Button onClick={() => navigate('/kyc')} size="sm">
                {identity?.kyc_status === 'not_started' || identity?.kyc_status === 'not_initiated' 
                  ? 'Iniciar Verificação' 
                  : 'Ver Status'}
              </Button>
            )}
          </div>
        </Card>

        {/* Token NFT de Identidade */}
        <Card title="Token NFT de Identidade">
          {identity?.nft_active ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-green-100 p-3 rounded-lg">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status do Token</p>
                    <div className="mt-1">
                      {getNftStatusBadge(true)}
                    </div>
                  </div>
                </div>
              </div>

              {identity.nft_token_id && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Token ID</p>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-lg font-semibold">#{identity.nft_token_id}</p>
                    <a
                      href={`https://polygonscan.com/token/${IDENTITY_NFT_ADDRESS}?a=${identity.nft_token_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-brand-blue hover:underline text-sm"
                    >
                      Ver no PolygonScan
                      <ExternalLink className="w-4 h-4 ml-1" />
                    </a>
                  </div>
                </div>
              )}

              {identity.nft_tx_hash && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Transação de Mint</p>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-sm truncate max-w-xs">{identity.nft_tx_hash}</p>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => copyToClipboard(identity.nft_tx_hash!, 'Hash da transação')}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={`https://polygonscan.com/tx/${identity.nft_tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-brand-blue hover:underline text-sm"
                      >
                        Ver
                        <ExternalLink className="w-4 h-4 ml-1" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="bg-gray-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Token NFT não ativo
              </h3>
              <p className="text-gray-600 mb-4">
                {identity?.kyc_status === 'approved' 
                  ? 'Seu KYC foi aprovado, mas o NFT ainda não foi mintado. Aguarde o processamento.'
                  : 'Complete a verificação de identidade (KYC) para receber seu token NFT de identidade.'}
              </p>
              {identity?.kyc_status !== 'approved' && (
                <Button onClick={() => navigate('/kyc')}>
                  Iniciar Verificação
                </Button>
              )}
            </div>
          )}
        </Card>

        {/* Carteira Blockchain */}
        <Card title="Carteira Blockchain">
          {identity?.wallet_address ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <Wallet className="w-8 h-8 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Carteira Ativa</p>
                  <p className="text-green-600 font-medium">Conectada</p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Endereço da Carteira</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm truncate max-w-xs">{identity.wallet_address}</p>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => copyToClipboard(identity.wallet_address!, 'Endereço')}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <a
                      href={`https://polygonscan.com/address/${identity.wallet_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-brand-blue hover:underline text-sm"
                    >
                      Ver
                      <ExternalLink className="w-4 h-4 ml-1" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Rede:</strong> Polygon Mainnet (Chain ID: 137)
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Sua carteira é determinística e derivada da sua verificação biométrica.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="bg-gray-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Wallet className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Carteira não criada
              </h3>
              <p className="text-gray-600 mb-4">
                Complete a verificação de identidade (KYC) para criar sua carteira blockchain.
              </p>
              <Button onClick={() => navigate('/kyc')}>
                Iniciar Verificação
              </Button>
            </div>
          )}
        </Card>

        {/* Informações Adicionais */}
        <Card title="O que é o Token NFT de Identidade?">
          <div className="prose prose-sm max-w-none text-gray-600">
            <p>
              O Token NFT de Identidade é um token não-fungível (NFT) soulbound que representa 
              sua identidade verificada na blockchain Polygon. Este token:
            </p>
            <ul className="mt-4 space-y-2">
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span>É único e intransferível (soulbound)</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span>Comprova que você passou pela verificação de identidade (KYC)</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span>Permite assinar documentos com validade jurídica</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span>Está registrado permanentemente na blockchain</span>
              </li>
            </ul>
          </div>
        </Card>
      </div>
    </Layout>
  )
}
