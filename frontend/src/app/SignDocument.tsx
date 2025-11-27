import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import FileDrop from '../components/FileDrop'
import HashField from '../components/HashField'
import StatusBadge from '../components/StatusBadge'
import { showToast } from '../components/Toaster'
import { calculateSHA256 } from '../lib/hash'
import api from '../lib/api'
import { FileSignature, CheckCircle, ExternalLink, Clock, AlertTriangle } from 'lucide-react'

interface SignatureRecord {
  file_hash: string
  signature: string
  document_name: string
  document_url: string | null
  failsafe: boolean
  blockchain_tx: string | null
  signed_at: string | null
}

export default function SignDocument() {
  const [file, setFile] = useState<File | null>(null)
  const [hash, setHash] = useState('')
  const [password, setPassword] = useState('')
  const [documentName, setDocumentName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [history, setHistory] = useState<SignatureRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    loadSignatureHistory()
  }, [])

  const loadSignatureHistory = async () => {
    try {
      const response = await api.get('/signature/history')
      setHistory(response.data.history || [])
    } catch (error: any) {
      console.error('Erro ao carregar histórico:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setDocumentName(selectedFile.name)
    showToast('info', 'Calculando hash SHA-256...')
    
    try {
      const calculatedHash = await calculateSHA256(selectedFile)
      
      const normalizedHash = calculatedHash.startsWith('0x') 
        ? calculatedHash 
        : '0x' + calculatedHash
      
      setHash(normalizedHash)
      showToast('success', 'Hash SHA-256 calculado com sucesso!')
    } catch (error: any) {
      showToast('error', error.message || 'Erro ao calcular hash')
      console.error('Erro ao calcular hash:', error)
    }
  }

  const handleSign = async () => {
    if (!hash) {
      showToast('error', 'Selecione um documento primeiro')
      return
    }

    if (!password) {
      showToast('error', 'Digite sua senha')
      return
    }

    setLoading(true)
    setResult(null)

    try {
      let normalizedHash = hash.trim()
      if (!normalizedHash.startsWith('0x')) {
        normalizedHash = '0x' + normalizedHash
      }

      showToast('info', 'Assinando documento com seu token de identidade...')
      
      const response = await api.post('/signature/sign-document', {
        file_hash: normalizedHash,
        document_name: documentName,
        password: password
      })

      setResult(response.data)
      setPassword('')
      
      if (response.data.failsafe_triggered) {
        showToast('warning', 'ASSINATURA DE EMERGÊNCIA - NFT foi cancelado por segurança')
      } else {
        showToast('success', 'Documento assinado com sucesso!')
      }
      
      loadSignatureHistory()
      
    } catch (error: any) {
      console.error('Erro ao assinar documento:', error)
      
      let errorMessage = error.response?.data?.error 
        || error.response?.data?.message 
        || error.message 
        || 'Erro ao assinar documento'
      
      if (errorMessage.includes('NFT inativo') || errorMessage.includes('NFT ativo')) {
        errorMessage = 'Você precisa ter um NFT de identidade ativo para assinar documentos. Complete a verificação de identidade (KYC) primeiro.'
      } else if (errorMessage.includes('carteira') || errorMessage.includes('wallet')) {
        errorMessage = 'Você precisa completar a verificação de identidade (KYC) para criar sua carteira e assinar documentos.'
      } else if (errorMessage.includes('Senha incorreta')) {
        errorMessage = 'Senha incorreta. Digite a mesma senha usada para criar sua conta.'
      }
      
      showToast('error', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setHash('')
    setPassword('')
    setDocumentName('')
    setResult(null)
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold mb-2">Assinar Documento</h1>
          <p className="text-gray-600">
            Assine documentos digitalmente usando seu token NFT de identidade verificada
          </p>
        </div>

        {/* Diferença entre Registrar e Assinar */}
        <Card className="bg-blue-50 border-blue-200">
          <div className="flex items-start space-x-3">
            <FileSignature className="w-6 h-6 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">Qual a diferença entre Registrar e Assinar?</h3>
              <p className="text-sm text-blue-800 mt-1">
                <strong>Registrar:</strong> Cria uma prova de existência do documento na blockchain (timestamp).
              </p>
              <p className="text-sm text-blue-800">
                <strong>Assinar:</strong> Vincula sua identidade verificada (NFT) ao documento, criando uma assinatura digital com validade jurídica.
              </p>
            </div>
          </div>
        </Card>

        {/* Upload de Documento */}
        <Card title="Upload de Documento">
          <FileDrop onFileSelect={handleFileSelect} />
          
          {file && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Arquivo:</strong> {file.name}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Tamanho:</strong> {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          )}
        </Card>

        {hash && (
          <>
            <Card title="Hash do Documento">
              <HashField value={hash} label="SHA-256 Hash" />
              
              <div className="mt-4">
                <Input
                  label="Nome do Documento"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="documento.pdf"
                />
              </div>
            </Card>

            <Card title="Assinar com Token de Identidade">
              <div className="space-y-4">
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-yellow-800">
                        <strong>Atenção:</strong> Ao assinar este documento, você está vinculando sua identidade 
                        verificada a ele. Esta ação é registrada permanentemente na blockchain.
                      </p>
                    </div>
                  </div>
                </div>

                <Input
                  type="password"
                  label="Senha da Conta"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha para desbloquear a carteira"
                  required
                />

                <Button
                  onClick={handleSign}
                  disabled={loading || !password}
                  className="w-full"
                >
                  {loading ? 'Assinando...' : 'Assinar Documento'}
                </Button>
              </div>
            </Card>
          </>
        )}

        {/* Resultado da Assinatura */}
        {result && (
          <Card title="Assinatura Concluída">
            <div className="space-y-4">
              {result.failsafe_triggered ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 font-medium mb-2">
                    ASSINATURA DE EMERGÊNCIA ACIONADA
                  </p>
                  <p className="text-sm text-red-700">
                    Seu NFT foi cancelado por segurança. Esta assinatura foi marcada como emergencial.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium mb-2">
                    Documento assinado com sucesso!
                  </p>
                  <p className="text-sm text-green-700">
                    Sua assinatura foi registrada na blockchain Polygon.
                  </p>
                </div>
              )}

              {result.signature && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Assinatura Digital</p>
                  <p className="font-mono text-xs break-all">{result.signature}</p>
                </div>
              )}

              {result.blockchain_tx && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Transaction Hash</p>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-sm truncate max-w-xs">{result.blockchain_tx}</p>
                    <a
                      href={`https://polygonscan.com/tx/${result.blockchain_tx}`}
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

              <Button
                onClick={resetForm}
                variant="secondary"
                className="w-full"
              >
                Assinar Outro Documento
              </Button>
            </div>
          </Card>
        )}

        {/* Histórico de Assinaturas */}
        <Card title="Minhas Assinaturas">
          {loadingHistory ? (
            <p className="text-gray-600 text-center py-4">Carregando histórico...</p>
          ) : history.length === 0 ? (
            <p className="text-gray-600 text-center py-8">Nenhuma assinatura registrada ainda</p>
          ) : (
            <div className="space-y-4">
              {history.map((sig, index) => (
                <div key={index} className="border-b pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {sig.failsafe ? (
                        <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{sig.document_name}</p>
                        <p className="font-mono text-xs text-gray-500 mt-1">
                          {sig.file_hash.substring(0, 20)}...
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <p className="text-xs text-gray-500">
                            {sig.signed_at ? new Date(sig.signed_at).toLocaleString('pt-BR') : 'Data não disponível'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      {sig.failsafe ? (
                        <StatusBadge status="error">Emergência</StatusBadge>
                      ) : (
                        <StatusBadge status="success">Válida</StatusBadge>
                      )}
                      {sig.blockchain_tx && (
                        <a
                          href={`https://polygonscan.com/tx/${sig.blockchain_tx}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-brand-blue hover:underline text-xs"
                        >
                          Ver TX
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  )
}
