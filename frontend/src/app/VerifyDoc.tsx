import { useState } from 'react'
import Layout from '../components/Layout'
import Card from '../components/Card'
import Button from '../components/Button'
import FileDrop from '../components/FileDrop'
import HashField from '../components/HashField'
import StatusBadge from '../components/StatusBadge'
import { showToast } from '../components/Toaster'
import { calculateSHA256 } from '../lib/hash'
import api from '../lib/api'
import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'

export default function VerifyDoc() {
  const [file, setFile] = useState<File | null>(null)
  const [hash, setHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificationResult, setVerificationResult] = useState<any>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState('')

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setVerificationResult(null)
    showToast('info', 'Calculando hash...')
    
    try {
      const calculatedHash = await calculateSHA256(selectedFile)
      setHash(calculatedHash)
      showToast('success', 'Hash calculado com sucesso!')
    } catch (error) {
      showToast('error', 'Erro ao calcular hash')
    }
  }

  const handleVerify = async () => {
    if (!hash) {
      showToast('error', 'Selecione um documento primeiro')
      return
    }

    setLoading(true)

    try {
      const response = await api.post('/proxy/verify', { hash })
      setVerificationResult(response.data)

      if (response.data.verified) {
        showToast('success', 'Documento verificado com sucesso!')
        
        // Gerar QR Code
        const qrUrl = await QRCode.toDataURL(hash)
        setQrCodeUrl(qrUrl)
      } else {
        showToast('warning', 'Documento não encontrado na blockchain')
      }
    } catch (error: any) {
      showToast('error', error.response?.data?.error || 'Erro ao verificar documento')
    } finally {
      setLoading(false)
    }
  }

  const generatePDF = () => {
    const doc = new jsPDF()
    
    doc.setFontSize(20)
    doc.text('Certificado de Verificacao', 20, 20)
    
    doc.setFontSize(12)
    doc.text('BTS Blocktrust', 20, 35)
    doc.text(`Data: ${new Date().toLocaleString('pt-BR')}`, 20, 45)
    
    doc.text('Hash do Documento:', 20, 60)
    doc.setFontSize(10)
    doc.text(hash, 20, 70, { maxWidth: 170 })
    
    doc.setFontSize(12)
    doc.text('Status: VERIFICADO', 20, 85)
    doc.text(`Transacao: ${verificationResult.tx_hash}`, 20, 95)
    doc.text(`Assinante: ${verificationResult.signer}`, 20, 105)
    
    if (qrCodeUrl) {
      doc.addImage(qrCodeUrl, 'PNG', 20, 120, 50, 50)
    }
    
    doc.save('certificado-verificacao.pdf')
    showToast('success', 'Certificado gerado com sucesso!')
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold mb-2">Verificar Documento</h1>
          <p className="text-gray-600">
            Verifique a autenticidade de um documento registrado na blockchain
          </p>
        </div>

        <Card title="1. Selecione o Documento">
          <FileDrop onFileSelect={handleFileSelect} />
          {file && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Arquivo selecionado:</p>
              <p className="font-medium">{file.name}</p>
            </div>
          )}
        </Card>

        {hash && (
          <Card title="2. Hash do Documento">
            <HashField hash={hash} />
            <Button
              onClick={handleVerify}
              disabled={loading}
              className="w-full mt-4"
            >
              {loading ? 'Verificando...' : 'Verificar na Blockchain'}
            </Button>
          </Card>
        )}

        {verificationResult && (
          <Card title="3. Resultado da Verificação">
            {verificationResult.verified ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Status:</span>
                  <StatusBadge status="success">✓ Verificado</StatusBadge>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 mb-1">Transaction Hash:</p>
                  <p className="font-mono text-sm break-all">{verificationResult.tx_hash}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 mb-1">Assinante:</p>
                  <p className="font-mono text-sm">{verificationResult.signer}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 mb-1">Data de Registro:</p>
                  <p className="text-sm">
                    {new Date(verificationResult.timestamp).toLocaleString('pt-BR')}
                  </p>
                </div>

                {qrCodeUrl && (
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">QR Code do Documento:</p>
                    <img src={qrCodeUrl} alt="QR Code" className="mx-auto w-48 h-48" />
                  </div>
                )}

                <Button onClick={generatePDF} className="w-full">
                  Gerar Certificado PDF
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <StatusBadge status="error">✗ Não Verificado</StatusBadge>
                <p className="text-gray-600 mt-4">
                  Este documento não foi encontrado na blockchain.
                </p>
              </div>
            )}
          </Card>
        )}
      </div>
    </Layout>
  )
}

