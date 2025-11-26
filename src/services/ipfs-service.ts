import { create, IPFSHTTPClient } from 'ipfs-http-client';

/**
 * Serviço IPFS para upload e retrieval de documentos na Polygon
 * Configurado para usar gateway público do IPFS
 */
export class IPFSService {
  private client: IPFSHTTPClient;
  private gateway: string;

  constructor(
    nodeUrl = 'https://ipfs.infura.io:5001/api/v0',
    gatewayUrl = 'https://ipfs.infura.io/ipfs/'
  ) {
    this.client = create({ url: nodeUrl });
    this.gateway = gatewayUrl;
  }

  /**
   * Upload de documento para IPFS
   * @param file Arquivo a ser enviado
   * @param metadata Metadados do documento
   * @returns Hash IPFS do documento
   */
  async uploadDocument(
    file: File,
    metadata: {
      title: string;
      description: string;
      creator: string;
      timestamp: number;
      mimeType: string;
      size: number;
    }
  ): Promise<{
    documentHash: string;
    metadataHash: string;
    url: string;
  }> {
    try {
      // Upload do arquivo principal
      const fileBuffer = await this.fileToBuffer(file);
      const fileResult = await this.client.add(fileBuffer, {
        progress: (prog) => console.log(`Upload progress: ${prog}`)
      });

      // Criar objeto de metadados completos
      const fullMetadata = {
        ...metadata,
        fileName: file.name,
        fileHash: fileResult.cid.toString(),
        uploadedAt: Date.now(),
        version: '1.0'
      };

      // Upload dos metadados
      const metadataBuffer = Buffer.from(JSON.stringify(fullMetadata, null, 2));
      const metadataResult = await this.client.add(metadataBuffer);

      return {
        documentHash: fileResult.cid.toString(),
        metadataHash: metadataResult.cid.toString(),
        url: `${this.gateway}${fileResult.cid.toString()}`
      };
    } catch (error) {
      console.error('Erro no upload para IPFS:', error);
      throw new Error(`Falha no upload IPFS: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Upload de metadados de assinatura para IPFS
   * @param signatureMetadata Dados da assinatura
   * @returns Hash IPFS dos metadados
   */
  async uploadSignatureMetadata(signatureMetadata: {
    documentId: string;
    signer: string;
    timestamp: number;
    signatureType: string;
    polygonTxHash?: string;
    additionalData?: any;
  }): Promise<string> {
    try {
      const metadata = {
        ...signatureMetadata,
        uploadedAt: Date.now(),
        ipfsVersion: '1.0'
      };

      const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2));
      const result = await this.client.add(metadataBuffer);

      return result.cid.toString();
    } catch (error) {
      console.error('Erro no upload de metadados de assinatura:', error);
      throw new Error(`Falha no upload de metadados: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Recuperar documento do IPFS
   * @param hash Hash IPFS do documento
   * @returns Dados do documento
   */
  async getDocument(hash: string): Promise<{
    data: Uint8Array;
    url: string;
  }> {
    try {
      const chunks: Uint8Array[] = [];
      
      for await (const chunk of this.client.cat(hash)) {
        chunks.push(chunk);
      }

      const data = this.concatUint8Arrays(chunks);
      
      return {
        data,
        url: `${this.gateway}${hash}`
      };
    } catch (error) {
      console.error('Erro ao recuperar documento do IPFS:', error);
      throw new Error(`Falha ao recuperar documento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Recuperar metadados do IPFS
   * @param hash Hash IPFS dos metadados
   * @returns Metadados parseados
   */
  async getMetadata(hash: string): Promise<any> {
    try {
      const chunks: Uint8Array[] = [];
      
      for await (const chunk of this.client.cat(hash)) {
        chunks.push(chunk);
      }

      const data = this.concatUint8Arrays(chunks);
      const text = new TextDecoder().decode(data);
      
      return JSON.parse(text);
    } catch (error) {
      console.error('Erro ao recuperar metadados do IPFS:', error);
      throw new Error(`Falha ao recuperar metadados: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Verificar se um hash IPFS é válido e acessível
   * @param hash Hash IPFS para verificar
   * @returns Status de disponibilidade
   */
  async verifyHash(hash: string): Promise<{
    exists: boolean;
    size?: number;
    error?: string;
  }> {
    try {
      const stat = await this.client.files.stat(`/ipfs/${hash}`);
      return {
        exists: true,
        size: stat.size
      };
    } catch (error) {
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Hash não encontrado'
      };
    }
  }

  /**
   * Obter URL pública para um hash IPFS
   * @param hash Hash IPFS
   * @returns URL pública
   */
  getPublicUrl(hash: string): string {
    return `${this.gateway}${hash}`;
  }

  /**
   * Obter múltiplas URLs de gateway para redundância
   * @param hash Hash IPFS
   * @returns Array de URLs públicas
   */
  getRedundantUrls(hash: string): string[] {
    const gateways = [
      'https://ipfs.infura.io/ipfs/',
      'https://ipfs.io/ipfs/',
      'https://gateway.pinata.cloud/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://dweb.link/ipfs/'
    ];

    return gateways.map(gateway => `${gateway}${hash}`);
  }

  /**
   * Upload de múltiplos arquivos como diretório
   * @param files Array de arquivos
   * @param directoryName Nome do diretório
   * @returns Hash do diretório e hashes individuais
   */
  async uploadMultipleFiles(
    files: File[],
    directoryName: string
  ): Promise<{
    directoryHash: string;
    fileHashes: { name: string; hash: string }[];
  }> {
    try {
      const filesToAdd: any[] = [];

      for (const file of files) {
        const buffer = await this.fileToBuffer(file);
        filesToAdd.push({
          path: `${directoryName}/${file.name}`,
          content: buffer
        });
      }

      const results: any[] = [];
      for await (const result of this.client.addAll(filesToAdd, { wrapWithDirectory: true })) {
        results.push(result);
      }

      const directoryResult = results.find(r => r.path === directoryName);
      const fileResults = results.filter(r => r.path !== directoryName);

      return {
        directoryHash: directoryResult.cid.toString(),
        fileHashes: fileResults.map(r => ({
          name: r.path.replace(`${directoryName}/`, ''),
          hash: r.cid.toString()
        }))
      };
    } catch (error) {
      console.error('Erro no upload múltiplo para IPFS:', error);
      throw new Error(`Falha no upload múltiplo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Calcular custos estimados para armazenamento
   * @param fileSizeBytes Tamanho do arquivo em bytes
   * @returns Estimativa de custos
   */
  estimateStorageCosts(fileSizeBytes: number): {
    sizeFormatted: string;
    estimatedCostUSD: number;
    polygonGasCost: string;
  } {
    const sizeInMB = fileSizeBytes / (1024 * 1024);
    const costPerMBPerYear = 0.08; // Estimativa em USD
    
    return {
      sizeFormatted: sizeInMB < 1 
        ? `${(fileSizeBytes / 1024).toFixed(2)} KB`
        : `${sizeInMB.toFixed(2)} MB`,
      estimatedCostUSD: sizeInMB * costPerMBPerYear,
      polygonGasCost: '~0.001 MATIC' // Estimativa para Polygon
    };
  }

  // Métodos utilitários privados
  private async fileToBuffer(file: File): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(Buffer.from(reader.result));
        } else {
          reject(new Error('Falha ao ler arquivo'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  private concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((acc, array) => acc + array.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const array of arrays) {
      result.set(array, offset);
      offset += array.length;
    }
    
    return result;
  }
}

// Instância singleton para uso na aplicação
export const ipfsService = new IPFSService(
  process.env.NEXT_PUBLIC_IPFS_NODE_URL,
  process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL
);

// Tipos TypeScript para uso na aplicação
export interface DocumentUploadResult {
  documentHash: string;
  metadataHash: string;
  url: string;
}

export interface DocumentMetadata {
  title: string;
  description: string;
  creator: string;
  timestamp: number;
  mimeType: string;
  size: number;
  fileName?: string;
  fileHash?: string;
  uploadedAt?: number;
  version?: string;
}

export interface SignatureMetadata {
  documentId: string;
  signer: string;
  timestamp: number;
  signatureType: string;
  polygonTxHash?: string;
  additionalData?: any;
  uploadedAt?: number;
  ipfsVersion?: string;
}
