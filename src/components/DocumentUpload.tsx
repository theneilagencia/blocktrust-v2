import React, { useState, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useDocumentSignature, Document } from '../hooks/useDocumentSignature';
import { ipfsService } from '../services/ipfs-service';

interface DocumentUploadProps {
  onSuccess?: (document: { documentId: number; txHash: string }) => void;
  onError?: (error: string) => void;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  onSuccess,
  onError
}) => {
  const { address, isConnected } = useAccount();
  const { createDocument, loading } = useDocumentSignature();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    // Validações
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (file.size > maxSize) {
      const error = 'Arquivo muito grande. Tamanho máximo: 10MB';
      onError?.(error);
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      const error = 'Tipo de arquivo não suportado. Use PDF, DOC, DOCX, TXT, JPG ou PNG';
      onError?.(error);
      return;
    }

    setSelectedFile(file);
  }, [onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      onError?.('Por favor, conecte sua carteira primeiro');
      return;
    }

    if (!selectedFile || !title.trim() || !description.trim()) {
      onError?.('Preencha todos os campos e selecione um arquivo');
      return;
    }

    try {
      setUploadProgress(0);

      // Simular progresso do upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev === null) return 10;
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 200);

      const result = await createDocument(selectedFile, title.trim(), description.trim());
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      // Reset form
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setTimeout(() => {
        setUploadProgress(null);
        onSuccess?.(result);
      }, 1000);

    } catch (error) {
      setUploadProgress(null);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar documento';
      onError?.(errorMessage);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStorageEstimate = useCallback(() => {
    if (!selectedFile) return null;
    return ipfsService.estimateStorageCosts(selectedFile.size);
  }, [selectedFile]);

  const storageEstimate = getStorageEstimate();

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Criar Novo Documento na Polygon
      </h2>

      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                Conecte sua carteira para criar documentos na Polygon
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Título */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Título do Documento *
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Contrato de Prestação de Serviços"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            disabled={loading}
            required
          />
        </div>

        {/* Descrição */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Descrição *
          </label>
          <textarea
            id="description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva o documento e sua finalidade..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            disabled={loading}
            required
          />
        </div>

        {/* Upload de Arquivo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Arquivo do Documento *
          </label>
          
          <div
            className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
              dragOver
                ? 'border-purple-400 bg-purple-50'
                : 'border-gray-300 bg-gray-50'
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              className="hidden"
              disabled={loading}
            />

            <div className="text-center">
              {selectedFile ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center">
                    <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="text-sm text-red-600 hover:text-red-800"
                    disabled={loading}
                  >
                    Remover arquivo
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-purple-600 hover:text-purple-800 font-medium"
                      disabled={loading}
                    >
                      Clique para selecionar
                    </button>
                    <span className="text-gray-500"> ou arraste e solte</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    PDF, DOC, DOCX, TXT, JPG, PNG (máx. 10MB)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Estimativa de Custos */}
        {storageEstimate && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              Estimativa de Custos (Polygon)
            </h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>Tamanho: {storageEstimate.sizeFormatted}</p>
              <p>Armazenamento IPFS/ano: ~${storageEstimate.estimatedCostUSD.toFixed(4)} USD</p>
              <p>Taxa de Gas (Polygon): {storageEstimate.polygonGasCost}</p>
            </div>
          </div>
        )}

        {/* Progresso do Upload */}
        {uploadProgress !== null && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Criando documento...</span>
              <span className="text-gray-900">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Botão Submit */}
        <button
          type="submit"
          disabled={!isConnected || loading || !selectedFile || !title.trim() || !description.trim()}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Criando documento...
            </>
          ) : (
            'Criar Documento na Polygon'
          )}
        </button>
      </form>

      {/* Informações Adicionais */}
      <div className="mt-6 p-4 bg-gray-50 rounded-md">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          Sobre o Armazenamento Descentralizado
        </h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p>• Seu documento será armazenado no IPFS (InterPlanetary File System)</p>
          <p>• O hash do documento será registrado na blockchain Polygon</p>
          <p>• Isso garante imutabilidade e disponibilidade descentralizada</p>
          <p>• As assinaturas serão registradas diretamente na blockchain</p>
        </div>
      </div>
    </div>
  );
};

export default DocumentUpload;
