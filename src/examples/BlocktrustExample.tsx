import React, { useState, useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { useDocumentSignature } from '../hooks/useDocumentSignature';
import DocumentUpload from '../components/DocumentUpload';
import DocumentSignature from '../components/DocumentSignature';

/**
 * Exemplo prático de uso do sistema Blocktrust na Polygon
 * Este componente demonstra o fluxo completo de:
 * 1. Conexão de carteira
 * 2. Upload de documento para IPFS
 * 3. Criação de documento na blockchain
 * 4. Assinatura digital EIP-712
 * 5. Verificação de assinaturas
 */
export const BlocktrustExample: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect({ connector: new MetaMaskConnector() });
  
  const {
    documents,
    loading,
    error,
    createDocument,
    signDocument,
    getDocument,
    getDocumentSignatures,
    clearError,
    stats,
    isContractAvailable
  } = useDocumentSignature();

  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [notifications, setNotifications] = useState<string[]>([]);

  // Estado de demonstração
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (error) {
      addNotification(`❌ Erro: ${error}`);
    }
  }, [error]);

  const addNotification = (message: string) => {
    setNotifications(prev => [message, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setNotifications(prev => prev.slice(0, -1));
    }, 5000);
  };

  const handleWalletConnect = async () => {
    try {
      await connect();
      addNotification('✅ Carteira conectada com sucesso!');
      setStep(2);
    } catch (error) {
      addNotification('❌ Erro ao conectar carteira');
    }
  };

  const handleDocumentUpload = async (result: { documentId: number; txHash: string }) => {
    addNotification(`✅ Documento criado! ID: ${result.documentId}`);
    addNotification(`📋 Transação: ${result.txHash}`);
    
    // Buscar o documento criado
    const document = await getDocument(result.documentId);
    if (document) {
      setSelectedDocument(document);
      setStep(3);
    }
  };

  const handleDocumentSign = async (result: { signatureId: number; txHash: string }) => {
    addNotification(`✅ Documento assinado! Signature ID: ${result.signatureId}`);
    addNotification(`📋 Transação: ${result.txHash}`);
    setStep(4);
  };

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const getStepStatus = (stepNumber: number) => {
    if (step > stepNumber) return 'completed';
    if (step === stepNumber) return 'current';
    return 'pending';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🔐 Blocktrust - Assinaturas na Polygon
          </h1>
          <p className="text-lg text-gray-600">
            Sistema descentralizado de assinaturas digitais com armazenamento IPFS
          </p>
          
          {/* Status da rede e contratos */}
          <div className="mt-4 flex items-center justify-center space-x-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              isConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {isConnected ? `✅ ${formatAddress(address!)}` : '❌ Carteira não conectada'}
            </div>
            
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              isContractAvailable ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-600'
            }`}>
              {isContractAvailable ? '✅ Contratos disponíveis' : '❌ Contratos não disponíveis'}
            </div>
          </div>

          {/* Stats da blockchain */}
          {stats && (
            <div className="mt-4 grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="bg-white p-3 rounded-lg shadow">
                <div className="text-2xl font-bold text-blue-600">{stats[0]}</div>
                <div className="text-xs text-gray-500">Documentos</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow">
                <div className="text-2xl font-bold text-green-600">{stats[1]}</div>
                <div className="text-xs text-gray-500">Assinaturas</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow">
                <div className="text-2xl font-bold text-purple-600">{stats[2]}</div>
                <div className="text-xs text-gray-500">Ativos</div>
              </div>
            </div>
          )}
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-8">
              {[
                { number: 1, title: 'Conectar Carteira' },
                { number: 2, title: 'Criar Documento' },
                { number: 3, title: 'Assinar Documento' },
                { number: 4, title: 'Verificar Assinatura' }
              ].map((stepItem) => (
                <div key={stepItem.number} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    getStepStatus(stepItem.number) === 'completed'
                      ? 'bg-green-500 border-green-500 text-white'
                      : getStepStatus(stepItem.number) === 'current'
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-gray-200 border-gray-300 text-gray-500'
                  }`}>
                    {getStepStatus(stepItem.number) === 'completed' ? '✓' : stepItem.number}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    getStepStatus(stepItem.number) !== 'pending' ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {stepItem.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="mb-6 space-y-2">
            {notifications.map((notification, index) => (
              <div
                key={index}
                className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800 animate-fade-in"
              >
                {notification}
              </div>
            ))}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-red-400 mr-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">Erro encontrado</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button
                  onClick={clearError}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Limpar erro
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Step 1: Wallet Connection */}
            {!isConnected && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4">1. 🔗 Conectar Carteira</h2>
                <p className="text-gray-600 mb-4">
                  Conecte sua carteira MetaMask ou outra carteira compatível para começar.
                </p>
                <button
                  onClick={handleWalletConnect}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  Conectar MetaMask
                </button>
                
                <div className="mt-4 p-3 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-800">
                    💡 Certifique-se de estar conectado à rede Polygon Amoy (Testnet)
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Document Upload */}
            {isConnected && step >= 2 && (
              <div className="bg-white rounded-lg shadow-lg">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-bold">2. 📄 Criar Documento</h2>
                  <p className="text-gray-600 mt-2">
                    Faça upload do documento que será assinado. Ele será armazenado no IPFS.
                  </p>
                </div>
                
                <DocumentUpload
                  onSuccess={handleDocumentUpload}
                  onError={(error) => addNotification(`❌ ${error}`)}
                />
              </div>
            )}

            {/* Step 3: Document Signing */}
            {selectedDocument && step >= 3 && (
              <div className="bg-white rounded-lg shadow-lg">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-bold">3. ✍️ Assinar Documento</h2>
                  <p className="text-gray-600 mt-2">
                    Assine o documento usando sua carteira. A assinatura será registrada na Polygon.
                  </p>
                </div>
                
                <DocumentSignature
                  document={selectedDocument}
                  onSign={handleDocumentSign}
                  onError={(error) => addNotification(`❌ ${error}`)}
                />
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Documentos do usuário */}
            {isConnected && documents.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold mb-4">📚 Meus Documentos</h3>
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={`p-4 border rounded-md cursor-pointer transition-colors ${
                        selectedDocument?.id === doc.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedDocument(doc)}
                    >
                      <div className="font-medium text-gray-900">{doc.title}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        ID: {doc.id} • Assinaturas: {doc.totalSignatures}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Criado em: {new Date(doc.createdAt * 1000).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tutorial */}
            <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                🎯 Como Funciona
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start space-x-2">
                  <span className="text-purple-600">1.</span>
                  <span>Documentos são armazenados no IPFS de forma descentralizada</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-purple-600">2.</span>
                  <span>Hashes dos documentos são registrados na blockchain Polygon</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-purple-600">3.</span>
                  <span>Assinaturas usam padrão EIP-712 para máxima segurança</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-purple-600">4.</span>
                  <span>Todas as operações são verificáveis na blockchain</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-purple-600">5.</span>
                  <span>Custos baixos graças à eficiência da Polygon</span>
                </div>
              </div>
            </div>

            {/* Informações técnicas */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                ⚙️ Informações Técnicas
              </h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Rede:</span>
                  <span className="font-medium">Polygon Amoy Testnet</span>
                </div>
                <div className="flex justify-between">
                  <span>Armazenamento:</span>
                  <span className="font-medium">IPFS Descentralizado</span>
                </div>
                <div className="flex justify-between">
                  <span>Assinaturas:</span>
                  <span className="font-medium">EIP-712 Standard</span>
                </div>
                <div className="flex justify-between">
                  <span>Gas Estimado:</span>
                  <span className="font-medium">~0.01 MATIC</span>
                </div>
              </div>
            </div>

            {/* Links úteis */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                🔗 Links Úteis
              </h3>
              <div className="space-y-2">
                <a
                  href="https://amoy.polygonscan.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-600 hover:text-blue-800 text-sm"
                >
                  📊 Polygon Amoy Explorer
                </a>
                <a
                  href="https://faucet.polygon.technology"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-600 hover:text-blue-800 text-sm"
                >
                  🚰 MATIC Testnet Faucet
                </a>
                <a
                  href="https://ipfs.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-600 hover:text-blue-800 text-sm"
                >
                  📁 IPFS Documentation
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500">
          <p className="text-sm">
            🔐 Blocktrust - Sistema de assinaturas descentralizado na Polygon
          </p>
          <p className="text-xs mt-2">
            Desenvolvido com ❤️ usando React, TypeScript, Solidity e IPFS
          </p>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <div className="flex items-center space-x-3">
              <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-gray-900 font-medium">Processando na blockchain...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlocktrustExample;
