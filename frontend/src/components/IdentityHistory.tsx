/**
 * @title Identity History Component
 * @dev Componente para exibir histórico completo de identidade
 * @author Blocktrust Team
 */

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface IdentityHistoryItem {
  tokenId: number;
  name: string;
  documentNumber: string;
  bioHash: string;
  kycTimestamp: number;
  isActive: boolean;
  previousTokenId: number;
  applicantId: string;
}

interface IdentityHistoryProps {
  bioHash: string;
  contractAddress: string;
  provider: ethers.Provider;
  className?: string;
}

interface HistoryStats {
  totalTokens: number;
  revocations: number;
  isSuspicious: boolean;
  suspicionReason?: string;
}

export const IdentityHistory: React.FC<IdentityHistoryProps> = ({
  bioHash,
  contractAddress,
  provider,
  className = ''
}) => {
  const [history, setHistory] = useState<IdentityHistoryItem[]>([]);
  const [stats, setStats] = useState<HistoryStats>({
    totalTokens: 0,
    revocations: 0,
    isSuspicious: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (bioHash && contractAddress && provider) {
      loadHistory();
    }
  }, [bioHash, contractAddress, provider]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError('');

      const contractABI = [
        'function getFullHistory(bytes32 bioHash) view returns (uint256[] memory tokenIds, tuple(string name, string documentNumber, bytes32 bioHash, uint256 kycTimestamp, bool isActive, uint256 previousTokenId, string applicantId)[] memory identityData, bool[] memory isActiveFlags)',
        'function getRevocationCount(bytes32 bioHash) view returns (uint256)',
        'function isSuspiciousActivity(bytes32 bioHash) view returns (bool isSuspicious, string memory reason)'
      ];

      const contract = new ethers.Contract(contractAddress, contractABI, provider);
      const bioHashBytes = ethers.keccak256(ethers.toUtf8Bytes(bioHash));

      // Carrega histórico completo
      const [tokenIds, identityData, isActiveFlags] = await contract.getFullHistory(bioHashBytes);
      
      // Carrega estatísticas
      const revocationCount = await contract.getRevocationCount(bioHashBytes);
      const [isSuspicious, suspicionReason] = await contract.isSuspiciousActivity(bioHashBytes);

      // Formata dados do histórico
      const formattedHistory: IdentityHistoryItem[] = tokenIds.map((tokenId: bigint, index: number) => ({
        tokenId: Number(tokenId),
        name: identityData[index].name,
        documentNumber: identityData[index].documentNumber,
        bioHash: identityData[index].bioHash,
        kycTimestamp: Number(identityData[index].kycTimestamp),
        isActive: isActiveFlags[index],
        previousTokenId: Number(identityData[index].previousTokenId),
        applicantId: identityData[index].applicantId
      }));

      // Ordena por timestamp (mais recente primeiro)
      formattedHistory.sort((a, b) => b.kycTimestamp - a.kycTimestamp);

      setHistory(formattedHistory);
      setStats({
        totalTokens: tokenIds.length,
        revocations: Number(revocationCount),
        isSuspicious: isSuspicious,
        suspicionReason: suspicionReason || undefined
      });

    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
      if (err instanceof Error && err.message.includes('revert')) {
        setError('Nenhum histórico encontrado para este bioHash');
      } else {
        setError('Erro ao carregar histórico de identidade');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString('pt-BR');
  };

  const formatTimeDifference = (currentTimestamp: number, previousTimestamp: number): string => {
    const diffSeconds = currentTimestamp - previousTimestamp;
    const diffDays = Math.floor(diffSeconds / (24 * 60 * 60));
    const diffHours = Math.floor((diffSeconds % (24 * 60 * 60)) / (60 * 60));

    if (diffDays > 0) {
      return `${diffDays} dias, ${diffHours} horas`;
    }
    return `${diffHours} horas`;
  };

  if (loading) {
    return (
      <div className={`flex justify-center items-center py-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Carregando histórico...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center">
          <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Cabeçalho com estatísticas */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Histórico de Identidade
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.totalTokens}</p>
            <p className="text-sm text-gray-600">Tokens Criados</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${stats.revocations > 3 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.revocations}
            </p>
            <p className="text-sm text-gray-600">Revogações</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${stats.isSuspicious ? 'text-red-600' : 'text-green-600'}`}>
              {stats.isSuspicious ? '⚠️' : '✅'}
            </p>
            <p className="text-sm text-gray-600">Status</p>
          </div>
        </div>

        {stats.isSuspicious && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded p-3">
            <p className="text-sm text-red-800">
              <strong>Atividade Suspeita Detectada:</strong> {stats.suspicionReason}
            </p>
          </div>
        )}
      </div>

      {/* Lista do histórico */}
      {history.length === 0 ? (
        <p className="text-gray-600 text-center py-8">Nenhum histórico encontrado</p>
      ) : (
        <div className="space-y-4">
          {history.map((item, index) => {
            const isCurrentActive = item.isActive;
            const previousItem = index < history.length - 1 ? history[index + 1] : null;
            
            return (
              <div
                key={item.tokenId}
                className={`border rounded-lg p-4 ${
                  isCurrentActive
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium text-gray-900">{item.name}</h4>
                    {isCurrentActive ? (
                      <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded">
                        Ativo
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-200 rounded">
                        Revogado
                      </span>
                    )}
                    {index === 0 && (
                      <span className="px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded">
                        Mais Recente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Token #{item.tokenId}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">
                      <strong>Documento:</strong> {item.documentNumber}
                    </p>
                    <p className="text-gray-600">
                      <strong>Aplicante:</strong> {item.applicantId}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">
                      <strong>KYC:</strong> {formatDate(item.kycTimestamp)}
                    </p>
                    {item.previousTokenId > 0 && (
                      <p className="text-gray-600">
                        <strong>Token Anterior:</strong> #{item.previousTokenId}
                      </p>
                    )}
                  </div>
                </div>

                {/* Tempo entre revogações */}
                {previousItem && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Tempo desde revogação anterior: {formatTimeDifference(item.kycTimestamp, previousItem.kycTimestamp)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Botão de atualizar */}
      <div className="text-center">
        <button
          onClick={loadHistory}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Atualizar Histórico
        </button>
      </div>
    </div>
  );
};

export default IdentityHistory;
