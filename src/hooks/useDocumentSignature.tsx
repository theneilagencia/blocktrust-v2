import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { useAccount, useContractWrite, useContractRead, useNetwork } from 'wagmi';
import { ipfsService, DocumentMetadata, SignatureMetadata } from '../services/ipfs-service';
import { useGaslessTransactions } from './useGasless';
import { accountAbstractionService } from '../services/account-abstraction.service';

// ABI do contrato DocumentSignature
const DOCUMENT_SIGNATURE_ABI = [
  // Funções de leitura
  "function getDocument(uint256 documentId) view returns (tuple(string ipfsHash, string title, string description, address creator, uint256 createdAt, bool isActive, uint256 totalSignatures, uint256 version))",
  "function getDocumentSignatures(uint256 documentId) view returns (uint256[] signatureIds, address[] signers, uint256[] timestamps, bool[] validFlags)",
  "function verifySignature(uint256 documentId, uint256 signatureId) view returns (bool isValid, address signer, uint256 timestamp)",
  "function canUserSign(address user, uint256 documentId) view returns (bool canSign, string reason)",
  "function getUserDocuments(address user) view returns (uint256[])",
  "function getUserSignatures(address user) view returns (uint256[])",
  "function getStats() view returns (uint256 totalDocuments, uint256 totalSignatures, uint256 activeDocuments)",
  
  // Funções de escrita
  "function createDocument(string ipfsHash, string title, string description) returns (uint256)",
  "function signDocument(uint256 documentId, uint256 identityTokenId, string ipfsMetadata, bytes signature) returns (uint256)",
  "function updateDocument(uint256 documentId, string newIpfsHash, string newDescription)",
  "function deactivateDocument(uint256 documentId, string reason)",
  "function createMultiSignRequest(uint256 documentId, address[] requiredSigners, uint256 deadline) returns (uint256)",
  
  // Eventos
  "event DocumentCreated(uint256 indexed documentId, string ipfsHash, address indexed creator, string title)",
  "event DocumentSigned(uint256 indexed documentId, uint256 indexed signatureId, address indexed signer, uint256 tokenId)",
  "event DocumentUpdated(uint256 indexed documentId, string newIpfsHash, uint256 newVersion)"
];

// Endereços dos contratos por rede
const CONTRACT_ADDRESSES = {
  // Polygon Amoy Testnet
  80002: process.env.NEXT_PUBLIC_DOCUMENT_SIGNATURE_AMOY || '',
  // Polygon Mainnet
  137: process.env.NEXT_PUBLIC_DOCUMENT_SIGNATURE_MAINNET || '',
};

export interface Document {
  id: number;
  ipfsHash: string;
  title: string;
  description: string;
  creator: string;
  createdAt: number;
  isActive: boolean;
  totalSignatures: number;
  version: number;
  metadata?: DocumentMetadata;
}

export interface DocumentSignature {
  id: number;
  documentId: number;
  identityTokenId: number;
  signer: string;
  timestamp: number;
  ipfsMetadata: string;
  signature: string;
  isValid: boolean;
  documentVersion: number;
  metadata?: SignatureMetadata;
}

/**
 * Hook principal para interação com o contrato DocumentSignature na Polygon
 */
export function useDocumentSignature() {
  const { address } = useAccount();
  const { chain } = useNetwork();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);

  // Gasless transaction integration
  const gaslessService = useGaslessTransactions();
  
  // Helper para verificar se deve usar gasless transactions
  const shouldUseGasless = useCallback((): boolean => {
    return gaslessService.isAvailable && gaslessService.canExecuteTransactions;
  }, [gaslessService.isAvailable, gaslessService.canExecuteTransactions]);

  // Helper para executar transação (gasless ou regular)
  const executeTransaction = useCallback(async (
    contractFunction: () => Promise<any>,
    gaslessParams?: { to: string; data: string; value?: string }
  ) => {
    if (shouldUseGasless() && gaslessParams) {
      try {
        // Tentar gasless primeiro
        const result = await gaslessService.executeGaslessTransaction(
          gaslessParams.to,
          gaslessParams.data,
          gaslessParams.value || '0'
        );
        
        if (result.success) {
          return { hash: result.transactionHash, wait: async () => ({ hash: result.transactionHash }) };
        } else {
          console.warn('Gasless transaction failed, falling back to regular:', result.error);
        }
      } catch (error) {
        console.warn('Gasless transaction error, falling back to regular:', error);
      }
    }
    
    // Fallback para transação regular
    return await contractFunction();
  }, [shouldUseGasless, gaslessService]);

  const contractAddress = chain?.id ? CONTRACT_ADDRESSES[chain.id as keyof typeof CONTRACT_ADDRESSES] : undefined;
  
  // Leitura de dados do contrato
  const { data: stats } = useContractRead({
    address: contractAddress as `0x${string}`,
    abi: DOCUMENT_SIGNATURE_ABI,
    functionName: 'getStats',
  });

  const { data: userDocsData } = useContractRead({
    address: contractAddress as `0x${string}`,
    abi: DOCUMENT_SIGNATURE_ABI,
    functionName: 'getUserDocuments',
    args: [address],
    enabled: !!address,
  });

  // Funções de escrita
  const { writeAsync: createDocumentWrite } = useContractWrite({
    address: contractAddress as `0x${string}`,
    abi: DOCUMENT_SIGNATURE_ABI,
    functionName: 'createDocument',
  });

  const { writeAsync: signDocumentWrite } = useContractWrite({
    address: contractAddress as `0x${string}`,
    abi: DOCUMENT_SIGNATURE_ABI,
    functionName: 'signDocument',
  });

  /**
   * Criar novo documento
   */
  const createDocument = useCallback(async (
    file: File,
    title: string,
    description: string
  ): Promise<{ documentId: number; txHash: string }> => {
    if (!address) throw new Error('Carteira não conectada');
    
    setLoading(true);
    setError(null);

    try {
      // 1. Upload do arquivo para IPFS
      const metadata: DocumentMetadata = {
        title,
        description,
        creator: address,
        timestamp: Date.now(),
        mimeType: file.type,
        size: file.size
      };

      const { documentHash, metadataHash } = await ipfsService.uploadDocument(file, metadata);

      // 2. Criar documento no contrato
      const tx = await createDocumentWrite({
        args: [documentHash, title, description]
      });

      // 3. Aguardar confirmação e obter documentId do evento
      const receipt = await tx.wait();
      const documentCreatedEvent = receipt.logs.find(
        log => log.topics[0] === ethers.utils.id('DocumentCreated(uint256,string,address,string)')
      );

      if (!documentCreatedEvent) {
        throw new Error('Evento DocumentCreated não encontrado');
      }

      const documentId = parseInt(documentCreatedEvent.topics[1], 16);

      // 4. Atualizar estado local
      await fetchUserDocuments();

      return {
        documentId,
        txHash: tx.hash
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar documento';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [address, createDocumentWrite]);

  /**
   * Assinar documento
   */
  const signDocument = useCallback(async (
    documentId: number,
    identityTokenId: number,
    additionalData?: any
  ): Promise<{ signatureId: number; txHash: string }> => {
    if (!address) throw new Error('Carteira não conectada');

    setLoading(true);
    setError(null);

    try {
      // 1. Criar metadados da assinatura
      const signatureMetadata: SignatureMetadata = {
        documentId: documentId.toString(),
        signer: address,
        timestamp: Date.now(),
        signatureType: 'EIP712',
        additionalData
      };

      const metadataHash = await ipfsService.uploadSignatureMetadata(signatureMetadata);

      // 2. Criar assinatura EIP-712
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const domain = {
        name: 'DocumentSignature',
        version: '1',
        chainId: chain?.id,
        verifyingContract: contractAddress
      };

      const types = {
        DocumentSignature: [
          { name: 'documentId', type: 'uint256' },
          { name: 'signer', type: 'address' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'ipfsMetadata', type: 'string' }
        ]
      };

      const message = {
        documentId,
        signer: address,
        timestamp: Date.now(),
        ipfsMetadata: metadataHash
      };

      const signature = await signer._signTypedData(domain, types, message);

      // 3. Enviar assinatura para o contrato
      const tx = await signDocumentWrite({
        args: [documentId, identityTokenId, metadataHash, signature]
      });

      // 4. Aguardar confirmação
      const receipt = await tx.wait();
      const signedEvent = receipt.logs.find(
        log => log.topics[0] === ethers.utils.id('DocumentSigned(uint256,uint256,address,uint256)')
      );

      if (!signedEvent) {
        throw new Error('Evento DocumentSigned não encontrado');
      }

      const signatureId = parseInt(signedEvent.topics[2], 16);

      return {
        signatureId,
        txHash: tx.hash
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao assinar documento';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [address, chain?.id, contractAddress, signDocumentWrite]);

  /**
   * Buscar documento por ID
   */
  const getDocument = useCallback(async (documentId: number): Promise<Document | null> => {
    if (!contractAddress) return null;

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, DOCUMENT_SIGNATURE_ABI, provider);
      
      const docData = await contract.getDocument(documentId);
      
      // Buscar metadados do IPFS
      let metadata: DocumentMetadata | undefined;
      try {
        metadata = await ipfsService.getMetadata(docData.ipfsHash);
      } catch {
        // Metadados podem não estar disponíveis
      }

      return {
        id: documentId,
        ipfsHash: docData.ipfsHash,
        title: docData.title,
        description: docData.description,
        creator: docData.creator,
        createdAt: docData.createdAt.toNumber(),
        isActive: docData.isActive,
        totalSignatures: docData.totalSignatures.toNumber(),
        version: docData.version.toNumber(),
        metadata
      };
    } catch (err) {
      console.error('Erro ao buscar documento:', err);
      return null;
    }
  }, [contractAddress]);

  /**
   * Buscar assinaturas de um documento
   */
  const getDocumentSignatures = useCallback(async (documentId: number): Promise<DocumentSignature[]> => {
    if (!contractAddress) return [];

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, DOCUMENT_SIGNATURE_ABI, provider);
      
      const sigData = await contract.getDocumentSignatures(documentId);
      
      const signatures: DocumentSignature[] = [];
      
      for (let i = 0; i < sigData.signatureIds.length; i++) {
        // Buscar dados completos da assinatura
        const sigDetails = await contract.signatures(documentId, sigData.signatureIds[i]);
        
        // Buscar metadados do IPFS
        let metadata: SignatureMetadata | undefined;
        try {
          metadata = await ipfsService.getMetadata(sigDetails.ipfsMetadata);
        } catch {
          // Metadados podem não estar disponíveis
        }

        signatures.push({
          id: sigData.signatureIds[i].toNumber(),
          documentId,
          identityTokenId: sigDetails.identityTokenId.toNumber(),
          signer: sigData.signers[i],
          timestamp: sigData.timestamps[i].toNumber(),
          ipfsMetadata: sigDetails.ipfsMetadata,
          signature: sigDetails.signature,
          isValid: sigData.validFlags[i],
          documentVersion: sigDetails.documentVersion.toNumber(),
          metadata
        });
      }

      return signatures;
    } catch (err) {
      console.error('Erro ao buscar assinaturas:', err);
      return [];
    }
  }, [contractAddress]);

  /**
   * Verificar se usuário pode assinar documento
   */
  const canUserSign = useCallback(async (
    userAddress: string,
    documentId: number
  ): Promise<{ canSign: boolean; reason: string }> => {
    if (!contractAddress) return { canSign: false, reason: 'Contrato não disponível' };

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, DOCUMENT_SIGNATURE_ABI, provider);
      
      const result = await contract.canUserSign(userAddress, documentId);
      
      return {
        canSign: result[0],
        reason: result[1]
      };
    } catch (err) {
      return {
        canSign: false,
        reason: err instanceof Error ? err.message : 'Erro desconhecido'
      };
    }
  }, [contractAddress]);

  /**
   * Buscar documentos do usuário
   */
  const fetchUserDocuments = useCallback(async () => {
    if (!address || !userDocsData) return;

    setLoading(true);
    try {
      const docs: Document[] = [];
      
      for (const docId of userDocsData as number[]) {
        const doc = await getDocument(docId);
        if (doc) {
          docs.push(doc);
        }
      }
      
      setDocuments(docs);
      setUserDocuments(userDocsData as number[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar documentos');
    } finally {
      setLoading(false);
    }
  }, [address, userDocsData, getDocument]);

  // Efeitos
  useEffect(() => {
    if (userDocsData) {
      fetchUserDocuments();
    }
  }, [userDocsData, fetchUserDocuments]);

  return {
    // Estado
    loading,
    error,
    documents,
    userDocuments,
    stats: stats as [number, number, number] | undefined,
    contractAddress,

    // Funções
    createDocument,
    signDocument,
    getDocument,
    getDocumentSignatures,
    canUserSign,
    fetchUserDocuments,

    // Utilitários
    clearError: () => setError(null),
    isContractAvailable: !!contractAddress
  };
}

/**
 * Hook para monitoramento de eventos do contrato
 */
export function useDocumentSignatureEvents() {
  const { chain } = useNetwork();
  const contractAddress = chain?.id ? CONTRACT_ADDRESSES[chain.id as keyof typeof CONTRACT_ADDRESSES] : '';
  
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!contractAddress || !window.ethereum) return;

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = new ethers.Contract(contractAddress, DOCUMENT_SIGNATURE_ABI, provider);

    // Listeners para eventos
    const handleDocumentCreated = (documentId: number, ipfsHash: string, creator: string, title: string) => {
      setEvents(prev => [...prev, {
        type: 'DocumentCreated',
        documentId: documentId.toString(),
        ipfsHash,
        creator,
        title,
        timestamp: Date.now()
      }]);
    };

    const handleDocumentSigned = (documentId: number, signatureId: number, signer: string, tokenId: number) => {
      setEvents(prev => [...prev, {
        type: 'DocumentSigned',
        documentId: documentId.toString(),
        signatureId: signatureId.toString(),
        signer,
        tokenId: tokenId.toString(),
        timestamp: Date.now()
      }]);
    };

    const handleDocumentUpdated = (documentId: number, newIpfsHash: string, newVersion: number) => {
      setEvents(prev => [...prev, {
        type: 'DocumentUpdated',
        documentId: documentId.toString(),
        newIpfsHash,
        newVersion: newVersion.toString(),
        timestamp: Date.now()
      }]);
    };

    contract.on('DocumentCreated', handleDocumentCreated);
    contract.on('DocumentSigned', handleDocumentSigned);
    contract.on('DocumentUpdated', handleDocumentUpdated);

    return () => {
      contract.off('DocumentCreated', handleDocumentCreated);
      contract.off('DocumentSigned', handleDocumentSigned);
      contract.off('DocumentUpdated', handleDocumentUpdated);
    };
  }, [contractAddress]);

  return {
    events,
    clearEvents: () => setEvents([])
  };
}
