import { useState } from 'react'
import Layout from '../components/Layout'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import FileDrop from '../components/FileDrop'
import HashField from '../components/HashField'
import { showToast } from '../components/Toaster'
import { calculateSHA256 } from '../lib/hash'
import api from '../lib/api'

export default function RegisterDoc() {
  const [file, setFile] = useState<File | null>(null)
  const [hash, setHash] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [documentName, setDocumentName] = useState('')

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setDocumentName(selectedFile.name)
    showToast('info', 'Calculando hash SHA-256...')
    
    try {
      const calculatedHash = await calculateSHA256(selectedFile)
      
      // Normalizar para bytes32 (garantir prefixo 0x)
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

  const handleRegister = async () => {
    if (!hash) {
      showToast('error', 'Selecione um documento primeiro')
      return
    }

    if (!password) {
      showToast('error', 'Digite sua senha')
      return
    }

    setLoading(true)

    try {
      // Normalizar hash (garantir 0x e 66 caracteres)
      let normalizedHash = hash.trim()
      if (!normalizedHash.startsWith('0x')) {
        normalizedHash = '0x' + normalizedHash
      }

      if (normalizedHash.length !== 66) {
        showToast('error', 'Hash inválido (deve ter 64 caracteres hexadecimais)')
        setLoading(false)
        return
      }

      showToast('info', 'Registrando documento na blockchain...')
      
      const response = await api.post('/document/register', {
        hash: normalizedHash,
        document_name: documentName,
        password: password
      })

      const resultTxHash = response.data.tx_hash

      setTxHash(resultTxHash)
      setPassword('') // Limpar senha
      showToast('success', 'Documento registrado na blockchain!')
      
      console.log('✅ Documento registrado:', {
        hash: normalizedHash,
        tx_hash: resultTxHash,
        document_name: documentName
      })
      
    } catch (error: any) {
      console.error('❌ Erro ao registrar documento:', error)
      
      const errorMessage = error.response?.data?.error 
        || error.response?.data?.message 
        || error.message 
        || 'Erro ao registrar documento'
      
      showToast('error', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold mb-2">Registrar Documento</h1>
          <p className="text-gray-600">
            Faça o registro blockchain do seu documento de forma segura usando sua carteira proprietária
          </p>
        </div>

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

            <Card title="Confirmação">
              <div className="space-y-4">
                <Input
                  type="password"
                  label="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                />

                <Button
                  onClick={handleRegister}
                  disabled={loading || !password}
                  className="w-full"
                >
                  {loading ? 'Registrando...' : 'Registrar na Blockchain'}
                </Button>
              </div>
            </Card>
          </>
        )}

        {txHash && (
          <Card title="Registro Concluído">
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium mb-2">
                  ✅ Documento registrado com sucesso!
                </p>
                <p className="text-sm text-green-700">
                  Seu documento foi registrado na blockchain Polygon.
                </p>
              </div>

              <HashField value={txHash} label="Transaction Hash" />

              <a
                href={`https://polygonscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-brand-blue hover:underline"
              >
                Ver no PolygonScan →
              </a>

              <Button
                onClick={() => {
                  setFile(null)
                  setHash('')
                  setTxHash('')
                  setPassword('')
                  setDocumentName('')
                }}
                variant="secondary"
                className="w-full"
              >
                Registrar Outro Documento
              </Button>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  )
}

