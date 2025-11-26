import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useDocumentSignature, Document, DocumentSignature } from '../hooks/useDocumentSignature';
import { ipfsService } from '../services/ipfs-service';

interface DocumentSignatureProps {
  document: Document;
  onSign?: (result: { signatureId: number; txHash: string }) => void;
  onError?: (error: string) => void;
}

export const DocumentSignatureComponent: React.FC<DocumentSignatureProps> = ({
  document,
  onSign,
  onError
}) => {
  const { address, isConnected } = useAccount();
  const { 
    signDocument, 
    getDocumentSignatures, 
    canUserSign,
    loading 
  } = useDocumentSignature();

  const [signatures, setSignatures] = useState<DocumentSignature[]>([]);
  const [canSign, setCanSign] = useState<{ canSign: boolean; reason: string }>({ canSign: false, reason: '' });
  const [documentContent, setDocumentContent] = useState<string | null>(null);
  const [signingInProgress, setSigningInProgress] = useState(false);
  const [identityTokenId, setIdentityTokenId] = useState<string>('1');
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  // Carregar assinaturas do documento
  const loadSignatures = useCallback(async () => {
    try {
      const sigs = await getDocumentSignatures(document.id);
      setSignatures(sigs);
    } catch (error) {
      console.error('Erro ao carregar assinaturas:', error);
    }
  }, [document.id, getDocumentSignatures]);

  // Verificar se usuário pode assinar
  const checkCanSign = useCallback(async () => {
    if (!address) {
      setCanSign({ canSign: false, reason: 'Carteira não conectada' });
      return;
    }

    try {
      const result = await canUserSign(address, document.id);
      setCanSign(result);
    } catch (error) {
      setCanSign({ canSign: false, reason: 'Erro ao verificar permissões' });
    }
  }, [address, document.id, canUserSign]);

  // Carregar prévia do documento do IPFS
  const loadDocumentPreview = useCallback(async () => {
    try {
      const metadata = document.metadata || await ipfsService.getMetadata(document.ipfsHash);
      
      if (metadata?.mimeType?.includes('text')) {
        const { data } = await ipfsService.getDocument(document.ipfsHash);
        const text = new TextDecoder().decode(data);
        setDocumentContent(text.substring(0, 500) + (text.length > 500 ? '...' : ''));
      }
    } catch (error) {
      console.error('Erro ao carregar prévia do documento:', error);
    }
  }, [document.ipfsHash, document.metadata]);

  // Executar assinatura
  const handleSign = async () => {
    if (!address || !canSign.canSign) {
      onError?.('Não é possível assinar este documento');
      return;
    }

    setSigningInProgress(true);

    try {
      const result = await signDocument(
        document.id,
        parseInt(identityTokenId),
        {
          documentTitle: document.title,
          documentVersion: document.version,
          signedAt: new Date().toISOString(),
          signerNote: 'Assinatura digital na Polygon'
        }
      );

      setShowSignatureModal(false);
      onSign?.(result);
      
      // Recarregar assinaturas
      await loadSignatures();
      await checkCanSign();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao assinar documento';
      onError?.(errorMessage);
    } finally {
      setSigningInProgress(false);
    }
  };

  // Efeitos
  useEffect(() => {
    loadSignatures();
    checkCanSign();
    loadDocumentPreview();
  }, [loadSignatures, checkCanSign, loadDocumentPreview]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('pt-BR');
  };

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const getDocumentUrl = () => {
    return ipfsService.getPublicUrl(document.ipfsHash);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Cabeçalho do Documento */}
      <div className="border-b pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">{document.title}</h3>
            <p className="text-gray-600 mb-3">{document.description}</p>
            
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <span>Criador: {formatAddress(document.creator)}</span>
              <span>Criado em: {formatDate(document.createdAt)}</span>
              <span>Versão: {document.version}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                document.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {document.isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>

          <div className="flex space-x-2">
            <a
              href={getDocumentUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
            >
              Ver Documento
            </a>
            
            {canSign.canSign && (
              <button
                onClick={() => setShowSignatureModal(true)}
                disabled={loading || signingInProgress}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {signingInProgress ? 'Assinando...' : 'Assinar Documento'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Prévia do Documento */}
      {documentContent && (
        <div className="mb-6">
          <h4 className="text-lg font-medium text-gray-900 mb-3">Prévia do Documento</h4>
          <div className="bg-gray-50 p-4 rounded-md border">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
              {documentContent}
            </pre>
            <p className="text-xs text-gray-500 mt-2">
              Prévia limitada. Clique em "Ver Documento" para visualizar o arquivo completo.
            </p>
          </div>
        </div>
      )}

      {/* Status de Assinatura */}
      {!canSign.canSign && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex">
            <svg className="h-5 w-5 text-yellow-400 mr-3 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">
                Não é possível assinar este documento
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Motivo: {canSign.reason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Assinaturas */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-medium text-gray-900">
            Assinaturas ({signatures.length})
          </h4>
          <button
            onClick={loadSignatures}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Atualizar
          </button>
        </div>

        {signatures.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>Nenhuma assinatura encontrada</p>
            <p className="text-sm mt-1">Seja o primeiro a assinar este documento!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {signatures.map((signature) => (
              <div
                key={signature.id}
                className={`p-4 rounded-lg border ${
                  signature.isValid 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-medium text-gray-900">
                        {formatAddress(signature.signer)}
                      </span>
                      {signature.isValid ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Válida
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          Inválida
                        </span>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Assinado em: {formatDate(signature.timestamp)}</p>
                      <p>Token ID: #{signature.identityTokenId}</p>
                      <p>Versão do documento: {signature.documentVersion}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">ID da Assinatura</p>
                    <p className="font-mono text-sm">#{signature.id}</p>
                    
                    {signature.metadata && (
                      <button
                        onClick={() => {
                          // Mostrar detalhes da assinatura
                          console.log('Signature metadata:', signature.metadata);
                        }}
                        className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                      >
                        Ver Metadados
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Assinatura */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Assinar Documento
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID do Token de Identidade
                </label>
                <input
                  type="number"
                  value={identityTokenId}
                  onChange={(e) => setIdentityTokenId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="1"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  ID do seu NFT de identidade na Polygon
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-md">
                <h4 className="text-sm font-medium text-blue-900 mb-2">
                  Informações da Assinatura
                </h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• Documento: {document.title}</p>
                  <p>• Versão: {document.version}</p>
                  <p>• Assinatura será registrada na Polygon</p>
                  <p>• Processo utiliza padrão EIP-712</p>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowSignatureModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  disabled={signingInProgress}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSign}
                  disabled={signingInProgress || !identityTokenId}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {signingInProgress ? 'Assinando...' : 'Confirmar Assinatura'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentSignatureComponent;
