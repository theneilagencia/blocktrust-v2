/**
 * @title Identity Recovery Flow Component
 * @dev Componente para recuperação de identidade usando biometria
 * @author Blocktrust Team
 */

import React, { useState } from 'react';
import { ethers } from 'ethers';
import { DeterministicWalletGenerator } from '../services/wallet-generator';
import { SecureStorage } from '../services/secure-storage';

// Declaração para o Sumsub SDK global
declare global {
  interface Window {
    snsWebSdk: any;
  }
}

interface RecoveryFlowProps {
  onRecoveryComplete: (wallet: ethers.Wallet, nftId: number, identityData: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

interface IdentityData {
  name: string;
  documentNumber: string;
  bioHash: string;
  kycTimestamp: number;
  isActive: boolean;
  previousTokenId: number;
  applicantId: string;
}

/**
 * Valida formato e conectividade de URL RPC
 */
const validateRpcUrl = async (rpcUrl: string): Promise<{ isValid: boolean; error?: string }> => {
  // Validação básica de formato
  if (!rpcUrl || !rpcUrl.trim()) {
    return { isValid: false, error: 'URL RPC é obrigatória' };
  }

  try {
    const url = new URL(rpcUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { isValid: false, error: 'URL RPC deve usar protocolo HTTP ou HTTPS' };
    }
  } catch {
    return { isValid: false, error: 'Formato de URL RPC inválido' };
  }

  // Teste de conectividade
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    await provider.getNetwork();
    return { isValid: true };
  } catch (error) {
    console.error('Erro ao conectar com RPC:', error);
    return { 
      isValid: false, 
      error: 'Não foi possível conectar à URL RPC fornecida' 
    };
  }
};

/**
 * Valida formato e existência de contrato
 */
const validateContractAddress = async (
  address: string, 
  provider: ethers.Provider
): Promise<{ isValid: boolean; error?: string }> => {
  // Validação básica
  if (!address || !address.trim()) {
    return { isValid: false, error: 'Endereço do contrato é obrigatório' };
  }

  // Validação de formato
  if (!ethers.isAddress(address)) {
    return { isValid: false, error: 'Formato de endereço inválido' };
  }

  // Validação de checksum
  try {
    const checksumAddress = ethers.getAddress(address);
    if (address !== checksumAddress && address !== address.toLowerCase()) {
      return { 
        isValid: false, 
        error: 'Endereço deve estar em formato checksum válido' 
      };
    }
  } catch {
    return { isValid: false, error: 'Endereço com checksum inválido' };
  }

  // Validação de código implantado
  try {
    const code = await provider.getCode(address);
    if (code === '0x') {
      return { 
        isValid: false, 
        error: 'Nenhum contrato encontrado no endereço fornecido' 
      };
    }
    return { isValid: true };
  } catch (error) {
    console.error('Erro ao verificar contrato:', error);
    return { 
      isValid: false, 
      error: 'Erro ao verificar se o contrato existe na blockchain' 
    };
  }
};

export const IdentityRecoveryFlow: React.FC<RecoveryFlowProps> = ({ 
  onRecoveryComplete,
  onCancel
}) => {
  const [step, setStep] = useState<'intro' | 'biometric' | 'loading' | 'password' | 'success' | 'error'>('intro');
  const [recoveredData, setRecoveredData] = useState<{
    wallet: ethers.Wallet;
    tokenId: string;
    identity: IdentityData;
    bioHash: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Estados de loading
  const [loadingSteps, setLoadingSteps] = useState({
    biometricVerified: false,
    walletGenerated: false,
    nftFound: false,
    ownershipValidated: false,
    walletSaved: false
  });

  // Estados para Sumsub SDK
  const [sumsubToken, setSumsubToken] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('user@example.com'); // TODO: Obter do contexto/props
  const [userPhone, setUserPhone] = useState<string>(''); // TODO: Obter do contexto/props
  const [userToken, setUserToken] = useState<string>(''); // TODO: Obter JWT token do usuário

  /**
   * Obtém token do Sumsub do backend
   */
  const getSumsubToken = async (): Promise<string> => {
    try {
      const response = await fetch('/api/kyc/get-sumsub-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          email: userEmail,
          phone: userPhone
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao obter token do Sumsub');
      }
      
      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Erro ao obter token:', error);
      throw error;
    }
  };

  /**
   * Captura biométrica real usando Sumsub SDK
   */
  const captureBiometric = async () => {
    try {
      setStep('biometric');
      
      // Obtém token do Sumsub
      const token = await getSumsubToken();
      setSumsubToken(token);
      
      // Configuração do Sumsub SDK
      const config = {
        lang: 'pt-BR',
        email: userEmail,
        phone: userPhone,
        i18n: {
          document: {
            subTitles: {
              IDENTITY: 'Verificação de Identidade',
            }
          }
        },
        onMessage: (type: string, payload: any) => {
          console.log('Sumsub message:', type, payload);
        },
        onError: (error: any) => {
          console.error('Sumsub error:', error);
          setErrorMessage('Erro na verificação biométrica');
          setStep('error');
        }
      };
      
      // Inicializa o SDK do Sumsub
      // @ts-ignore - Pode não ter tipos perfeitos
      const sumsub = window.snsWebSdk.init(token, config);
      
      // Handler quando aplicante é submetido
      sumsub.on('idCheck.onApplicantSubmitted', async (payload: any) => {
        console.log('Aplicante submetido:', payload);
        
        setStep('loading');
        
        // Aguarda processamento do KYC (pode levar alguns segundos)
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Obtém bioHash do backend
        try {
          const response = await fetch('/api/kyc/get-biohash', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({ 
              applicantId: payload.applicantId 
            })
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erro ao obter bioHash');
          }
          
          const { bioHash } = await response.json();
          
          // Inicia processo de recuperação
          await handleBiometricVerification(bioHash);
        } catch (error) {
          console.error('Erro ao obter bioHash:', error);
          setErrorMessage('Erro ao processar verificação biométrica');
          setStep('error');
        }
      });
      
      // Handler quando aplicante é aprovado
      sumsub.on('idCheck.onApplicantReviewed', (payload: any) => {
        console.log('Aplicante revisado:', payload);
        if (payload.reviewResult?.reviewAnswer === 'GREEN') {
          console.log('Verificação aprovada!');
        }
      });
      
      // Lança o SDK
      sumsub.launch('#sumsub-websdk-container');
      
    } catch (error) {
      console.error('Erro na captura biométrica:', error);
      setErrorMessage('Erro na captura biométrica: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
      setStep('error');
    }
  };

  /**
   * Simula verificação biométrica - em produção integrar com Sumsub
   */
  const handleBiometricVerification = async (bioHash: string) => {
    setStep('loading');
    setLoadingSteps(prev => ({ ...prev, biometricVerified: true }));
    
    try {
      await processRecovery(bioHash);
    } catch (error) {
      console.error('Erro na recuperação:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Erro desconhecido na recuperação');
      setStep('error');
    }
  };

  /**
   * Processa a recuperação completa da identidade
   */
  const processRecovery = async (bioHash: string) => {
    try {
      // 1. Regenera wallet determinística
      const wallet = DeterministicWalletGenerator.generateWallet(bioHash);
      setLoadingSteps(prev => ({ ...prev, walletGenerated: true }));
      
      // 2. Valida e conecta ao provider
      const rpcUrl = process.env.REACT_APP_RPC_URL || 'https://polygon-amoy.g.alchemy.com/v2/your-key';
      
      const rpcValidation = await validateRpcUrl(rpcUrl);
      if (!rpcValidation.isValid) {
        throw new Error(`RPC URL inválida: ${rpcValidation.error}`);
      }
      
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const connectedWallet = wallet.connect(provider);
      
      // 3. Valida endereço do contrato
      const contractAddress = process.env.REACT_APP_IDENTITY_NFT_ADDRESS;
      if (!contractAddress) {
        throw new Error('Endereço do contrato não configurado nas variáveis de ambiente');
      }
      
      const contractValidation = await validateContractAddress(contractAddress, provider);
      if (!contractValidation.isValid) {
        throw new Error(`Contrato inválido: ${contractValidation.error}`);
      }
      
      // 4. Busca NFT ativo no contrato
      // ABI simplificado - apenas as funções necessárias
      const contractABI = [
        'function getActiveTokenByBioHash(bytes32 bioHash) view returns (uint256 tokenId, address owner)',
        'function identities(uint256) view returns (string name, string documentNumber, bytes32 bioHash, uint256 kycTimestamp, bool isActive, uint256 previousTokenId, string applicantId)',
        'function validateWalletForBioHash(address walletAddress, bytes32 bioHash) view returns (bool isValid)'
      ];
      
      const contract = new ethers.Contract(contractAddress, contractABI, connectedWallet);
      
      // Converte bioHash para bytes32
      const bioHashBytes = ethers.id(bioHash);
      
      try {
        const [tokenId] = await contract.getActiveTokenByBioHash(bioHashBytes);
        setLoadingSteps(prev => ({ ...prev, nftFound: true }));
        
        // 5. Valida propriedade
        const isValidOwner = await contract.validateWalletForBioHash(wallet.address, bioHashBytes);
        if (!isValidOwner) {
          throw new Error('Endereço recuperado não corresponde ao proprietário do NFT');
        }
        setLoadingSteps(prev => ({ ...prev, ownershipValidated: true }));
        
        // 6. Recupera dados da identidade
        const identityData = await contract.identities(tokenId);
        const identity: IdentityData = {
          name: identityData.name,
          documentNumber: identityData.documentNumber,
          bioHash: identityData.bioHash,
          kycTimestamp: Number(identityData.kycTimestamp),
          isActive: identityData.isActive,
          previousTokenId: Number(identityData.previousTokenId),
          applicantId: identityData.applicantId
        };
        
        setRecoveredData({
          wallet,
          tokenId: tokenId.toString(),
          identity,
          bioHash
        });
        
        setStep('password');
        
      } catch (contractError) {
        console.error('Erro no contrato:', contractError);
        throw new Error('Identidade não encontrada na blockchain ou dados inconsistentes');
      }
      
    } catch (error) {
      console.error('Erro no processo de recuperação:', error);
      throw error;
    }
  };

  /**
   * Salva a wallet recuperada com senha do usuário
   */
  const saveRecoveredWallet = async () => {
    if (!recoveredData || !password) return;
    
    if (password !== confirmPassword) {
      setErrorMessage('Senhas não conferem');
      return;
    }
    
    if (password.length < 8) {
      setErrorMessage('Senha deve ter pelo menos 8 caracteres');
      return;
    }

    setIsProcessing(true);
    
    try {
      await SecureStorage.saveWallet(
        recoveredData.wallet,
        password,
        recoveredData.bioHash
      );
      
      setLoadingSteps(prev => ({ ...prev, walletSaved: true }));
      setStep('success');
      
      // Notifica componente pai
      onRecoveryComplete(
        recoveredData.wallet,
        Number(recoveredData.tokenId),
        recoveredData.identity
      );
      
    } catch (error) {
      console.error('Erro ao salvar wallet:', error);
      setErrorMessage('Erro ao salvar wallet: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="recovery-flow max-w-2xl mx-auto p-6">
      {/* Introdução */}
      {step === 'intro' && (
        <div className="text-center">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Recuperar Identidade</h2>
            <p className="text-gray-600">
              Para recuperar sua identidade blockchain, vamos verificar sua biometria e regenerar sua wallet de forma segura.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Como funciona:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Verificamos sua identidade através de biometria facial</li>
              <li>• Regeneramos sua wallet usando criptografia determinística</li>
              <li>• Recuperamos seu NFT de identidade da blockchain</li>
              <li>• Você define uma nova senha para proteção local</li>
            </ul>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setStep('biometric')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Iniciar Recuperação
            </button>
            <button
              onClick={onCancel}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Verificação Biométrica */}
      {step === 'biometric' && (
        <div className="text-center">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verificação Biométrica</h2>
            <p className="text-gray-600">
              Siga as instruções na tela para capturar sua biometria facial.
            </p>
          </div>

          {/* Container do Sumsub SDK */}
          <div id="sumsub-websdk-container" className="w-full min-h-[500px]"></div>
          
          <button
            onClick={onCancel}
            className="mt-4 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Carregamento */}
      {step === 'loading' && (
        <div className="text-center">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Recuperando Identidade</h2>
            <p className="text-gray-600 mb-6">
              Processando sua recuperação blockchain...
            </p>
          </div>

          <div className="space-y-3">
            {Object.entries({
              biometricVerified: 'Verificação biométrica concluída',
              walletGenerated: 'Regenerando wallet determinística',
              nftFound: 'Buscando NFT de identidade',
              ownershipValidated: 'Validando propriedade',
              walletSaved: 'Salvando wallet com segurança'
            }).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm">{label}</span>
                {loadingSteps[key as keyof typeof loadingSteps] ? (
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                ) : (
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Definir Senha */}
      {step === 'password' && recoveredData && (
        <div>
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Identidade Recuperada!</h2>
            <p className="text-gray-600">
              Agora defina uma senha para proteger sua wallet localmente.
            </p>
          </div>

          {/* Informações da identidade recuperada */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-green-900 mb-2">Dados Recuperados:</h3>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Nome:</span> {recoveredData.identity.name}</p>
              <p><span className="font-medium">Documento:</span> {recoveredData.identity.documentNumber}</p>
              <p><span className="font-medium">NFT ID:</span> #{recoveredData.tokenId}</p>
              <p><span className="font-medium">Endereço:</span> <span className="font-mono text-xs">{recoveredData.wallet.address}</span></p>
            </div>
          </div>

          {/* Formulário de senha */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nova Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mínimo 8 caracteres"
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar Senha
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Digite a senha novamente"
              />
            </div>

            {errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{errorMessage}</p>
              </div>
            )}

            <button
              onClick={saveRecoveredWallet}
              disabled={!password || !confirmPassword || isProcessing}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {isProcessing ? 'Salvando...' : 'Finalizar Recuperação'}
            </button>
          </div>
        </div>
      )}

      {/* Sucesso */}
      {step === 'success' && recoveredData && (
        <div className="text-center">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Recuperação Concluída!</h2>
            <p className="text-gray-600 mb-6">
              Sua identidade foi recuperada com sucesso. Você pode agora acessar todos os recursos da plataforma.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Próximos passos:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Sua wallet está segura e criptografada localmente</li>
              <li>• Seu NFT de identidade está ativo na blockchain</li>
              <li>• Você pode assinar documentos e verificar sua identidade</li>
              <li>• Lembre-se de sua senha para acessos futuros</li>
            </ul>
          </div>

          <button
            onClick={() => window.location.href = '/dashboard'}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Acessar Dashboard
          </button>
        </div>
      )}

      {/* Erro */}
      {step === 'error' && (
        <div className="text-center">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.598 0L3.266 16.5c-.77.833.192 2.5 1.732 2.5z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Erro na Recuperação</h2>
            <p className="text-gray-600 mb-4">
              Não foi possível recuperar sua identidade.
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800 mb-3">{errorMessage}</p>
            <p className="text-xs text-red-600">
              Possíveis causas: Sua biometria mudou significativamente, você ainda não possui uma identidade blockchain, 
              ou houve erro de conexão com a rede.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                setStep('intro');
                setErrorMessage('');
                setLoadingSteps({
                  biometricVerified: false,
                  walletGenerated: false,
                  nftFound: false,
                  ownershipValidated: false,
                  walletSaved: false
                });
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Tentar Novamente
            </button>
            <button
              onClick={onCancel}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
