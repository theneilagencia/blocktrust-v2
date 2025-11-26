import { ethers } from 'ethers';
import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';
import { ipfsService } from '../src/services/ipfs-service';

// Configurações
interface MigrationConfig {
  // PostgreSQL
  databaseUrl: string;
  
  // Polygon/Ethereum
  rpcUrl: string;
  privateKey: string;
  contractAddress: string;
  
  // IPFS
  ipfsNodeUrl?: string;
  ipfsGatewayUrl?: string;
  
  // Migração
  batchSize: number;
  maxRetries: number;
  delayBetweenBatches: number;
}

interface LegacySignature {
  id: number;
  document_hash: string;
  document_title: string;
  document_description: string;
  signer_address: string;
  signer_email?: string;
  signature_data: string;
  created_at: Date;
  is_valid: boolean;
  document_version: number;
}

interface MigrationResult {
  totalDocuments: number;
  migratedDocuments: number;
  totalSignatures: number;
  migratedSignatures: number;
  errors: string[];
  gasCosts: {
    totalGasUsed: number;
    totalCostETH: string;
    totalCostUSD?: string;
  };
}

// ABI do contrato DocumentSignature
const CONTRACT_ABI = [
  "function createDocument(string ipfsHash, string title, string description) returns (uint256)",
  "function signDocument(uint256 documentId, uint256 identityTokenId, string ipfsMetadata, bytes signature) returns (uint256)",
  "function getStats() view returns (uint256 totalDocuments, uint256 totalSignatures, uint256 activeDocuments)"
];

/**
 * Classe principal para migração de assinaturas
 */
export class SignatureMigration {
  private config: MigrationConfig;
  private db: Pool;
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private migrationLog: string[] = [];

  constructor(config: MigrationConfig) {
    this.config = config;
    this.db = new Pool({ connectionString: config.databaseUrl });
    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.contract = new ethers.Contract(config.contractAddress, CONTRACT_ABI, this.wallet);
  }

  /**
   * Executar migração completa
   */
  async migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      totalDocuments: 0,
      migratedDocuments: 0,
      totalSignatures: 0,
      migratedSignatures: 0,
      errors: [],
      gasCosts: {
        totalGasUsed: 0,
        totalCostETH: '0'
      }
    };

    try {
      this.log('🚀 Iniciando migração de assinaturas para Polygon...');
      
      // 1. Conectar ao banco e validar dados
      await this.validateDatabase();
      
      // 2. Buscar documentos e assinaturas do PostgreSQL
      const legacyData = await this.fetchLegacyData();
      result.totalDocuments = legacyData.documents.length;
      result.totalSignatures = legacyData.signatures.length;
      
      this.log(`📊 Encontrados ${result.totalDocuments} documentos e ${result.totalSignatures} assinaturas`);
      
      // 3. Migrar documentos para blockchain e IPFS
      const documentMapping = await this.migrateDocuments(legacyData.documents, result);
      
      // 4. Migrar assinaturas
      await this.migrateSignatures(legacyData.signatures, documentMapping, result);
      
      // 5. Validar migração
      await this.validateMigration(result);
      
      // 6. Gerar relatório
      await this.generateMigrationReport(result);
      
      this.log('✅ Migração concluída com sucesso!');
      
    } catch (error) {
      const errorMsg = `❌ Erro na migração: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
      this.log(errorMsg);
      result.errors.push(errorMsg);
    } finally {
      await this.db.end();
    }

    return result;
  }

  /**
   * Validar conexão com banco de dados
   */
  private async validateDatabase(): Promise<void> {
    try {
      const client = await this.db.connect();
      
      // Verificar se tabelas existem
      const tableCheck = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('documents', 'signatures')
      `);
      
      if (tableCheck.rows.length === 0) {
        throw new Error('Tabelas de documentos/assinaturas não encontradas no PostgreSQL');
      }
      
      client.release();
      this.log('✅ Conexão com PostgreSQL validada');
      
    } catch (error) {
      throw new Error(`Falha na conexão com PostgreSQL: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Buscar dados legados do PostgreSQL
   */
  private async fetchLegacyData(): Promise<{
    documents: any[];
    signatures: LegacySignature[];
  }> {
    const client = await this.db.connect();
    
    try {
      // Buscar documentos únicos
      const documentsResult = await client.query(`
        SELECT DISTINCT 
          document_hash,
          document_title,
          document_description,
          MIN(created_at) as created_at,
          COUNT(*) as signature_count
        FROM signatures 
        WHERE is_valid = true
        GROUP BY document_hash, document_title, document_description
        ORDER BY MIN(created_at)
      `);

      // Buscar todas as assinaturas válidas
      const signaturesResult = await client.query(`
        SELECT 
          id,
          document_hash,
          document_title,
          document_description,
          signer_address,
          signer_email,
          signature_data,
          created_at,
          is_valid,
          COALESCE(document_version, 1) as document_version
        FROM signatures 
        WHERE is_valid = true
        ORDER BY created_at
      `);

      return {
        documents: documentsResult.rows,
        signatures: signaturesResult.rows
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * Migrar documentos para IPFS e blockchain
   */
  private async migrateDocuments(
    documents: any[], 
    result: MigrationResult
  ): Promise<Map<string, number>> {
    const documentMapping = new Map<string, number>();
    
    this.log(`📄 Iniciando migração de ${documents.length} documentos...`);
    
    for (let i = 0; i < documents.length; i += this.config.batchSize) {
      const batch = documents.slice(i, i + this.config.batchSize);
      
      for (const doc of batch) {
        try {
          // Criar metadados do documento
          const metadata = {
            title: doc.document_title,
            description: doc.document_description,
            creator: 'legacy-migration',
            timestamp: new Date(doc.created_at).getTime(),
            mimeType: 'application/octet-stream',
            size: 0,
            originalHash: doc.document_hash,
            migratedAt: Date.now(),
            signatureCount: doc.signature_count
          };

          // Upload para IPFS (usando hash como placeholder)
          const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2));
          const ipfsResult = await ipfsService.client.add(metadataBuffer);
          
          // Criar documento na blockchain
          const tx = await this.contract.createDocument(
            ipfsResult.cid.toString(),
            doc.document_title,
            doc.document_description || 'Documento migrado do sistema legado',
            { gasLimit: 300000 }
          );
          
          const receipt = await tx.wait();
          result.gasCosts.totalGasUsed += receipt.gasUsed.toNumber();
          
          // Extrair documentId do evento
          const documentCreatedEvent = receipt.logs.find(
            (log: any) => log.topics[0] === ethers.utils.id('DocumentCreated(uint256,string,address,string)')
          );
          
          if (documentCreatedEvent) {
            const documentId = parseInt(documentCreatedEvent.topics[1], 16);
            documentMapping.set(doc.document_hash, documentId);
            result.migratedDocuments++;
            
            this.log(`✅ Documento migrado: "${doc.document_title}" -> ID ${documentId}`);
          }
          
        } catch (error) {
          const errorMsg = `Erro ao migrar documento "${doc.document_title}": ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
          this.log(`❌ ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }
      
      // Delay entre batches para evitar rate limiting
      if (i + this.config.batchSize < documents.length) {
        this.log(`⏳ Aguardando ${this.config.delayBetweenBatches}ms antes do próximo batch...`);
        await this.sleep(this.config.delayBetweenBatches);
      }
    }
    
    return documentMapping;
  }

  /**
   * Migrar assinaturas para blockchain
   */
  private async migrateSignatures(
    signatures: LegacySignature[],
    documentMapping: Map<string, number>,
    result: MigrationResult
  ): Promise<void> {
    this.log(`✍️ Iniciando migração de ${signatures.length} assinaturas...`);
    
    for (let i = 0; i < signatures.length; i += this.config.batchSize) {
      const batch = signatures.slice(i, i + this.config.batchSize);
      
      for (const sig of batch) {
        try {
          const documentId = documentMapping.get(sig.document_hash);
          
          if (!documentId) {
            throw new Error(`Documento não encontrado para hash: ${sig.document_hash}`);
          }
          
          // Criar metadados da assinatura para IPFS
          const signatureMetadata = {
            documentId: documentId.toString(),
            signer: sig.signer_address,
            timestamp: new Date(sig.created_at).getTime(),
            signatureType: 'LEGACY_MIGRATION',
            originalSignatureData: sig.signature_data,
            signerEmail: sig.signer_email,
            migratedAt: Date.now(),
            documentVersion: sig.document_version
          };
          
          const metadataHash = await ipfsService.uploadSignatureMetadata(signatureMetadata);
          
          // Recriar assinatura EIP-712 para compatibilidade
          const domain = {
            name: 'DocumentSignature',
            version: '1',
            chainId: (await this.provider.getNetwork()).chainId,
            verifyingContract: this.config.contractAddress
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
            signer: sig.signer_address,
            timestamp: Math.floor(new Date(sig.created_at).getTime() / 1000),
            ipfsMetadata: metadataHash
          };

          const signature = await this.wallet._signTypedData(domain, types, message);
          
          // Assumir token ID 1 para migração (pode ser ajustado conforme necessário)
          const identityTokenId = 1;
          
          // Submeter assinatura para a blockchain
          const tx = await this.contract.signDocument(
            documentId,
            identityTokenId,
            metadataHash,
            signature,
            { gasLimit: 400000 }
          );
          
          const receipt = await tx.wait();
          result.gasCosts.totalGasUsed += receipt.gasUsed.toNumber();
          result.migratedSignatures++;
          
          this.log(`✅ Assinatura migrada: Doc ${documentId} -> Assinante ${sig.signer_address.substring(0, 8)}...`);
          
        } catch (error) {
          const errorMsg = `Erro ao migrar assinatura ${sig.id}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
          this.log(`❌ ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }
      
      // Delay entre batches
      if (i + this.config.batchSize < signatures.length) {
        this.log(`⏳ Aguardando ${this.config.delayBetweenBatches}ms antes do próximo batch...`);
        await this.sleep(this.config.delayBetweenBatches);
      }
    }
  }

  /**
   * Validar migração comparando dados
   */
  private async validateMigration(result: MigrationResult): Promise<void> {
    try {
      this.log('🔍 Validando migração...');
      
      const stats = await this.contract.getStats();
      const onChainDocs = stats[0].toNumber();
      const onChainSigs = stats[1].toNumber();
      
      this.log(`📊 Blockchain stats: ${onChainDocs} docs, ${onChainSigs} sigs`);
      this.log(`📊 Migração stats: ${result.migratedDocuments} docs, ${result.migratedSignatures} sigs`);
      
      if (result.migratedDocuments !== onChainDocs || result.migratedSignatures !== onChainSigs) {
        throw new Error('Inconsistência detectada entre dados migrados e blockchain');
      }
      
      this.log('✅ Validação concluída com sucesso');
      
    } catch (error) {
      throw new Error(`Falha na validação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Gerar relatório de migração
   */
  private async generateMigrationReport(result: MigrationResult): Promise<void> {
    const gasPrice = await this.provider.getGasPrice();
    result.gasCosts.totalCostETH = ethers.utils.formatEther(
      gasPrice.mul(result.gasCosts.totalGasUsed)
    );

    const report = {
      timestamp: new Date().toISOString(),
      network: (await this.provider.getNetwork()).name,
      contractAddress: this.config.contractAddress,
      results: result,
      logs: this.migrationLog
    };

    const reportPath = path.join(process.cwd(), `migration-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    this.log(`📄 Relatório gerado: ${reportPath}`);
  }

  /**
   * Log com timestamp
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    this.migrationLog.push(logMessage);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Função principal para execução da migração
 */
export async function runMigration(): Promise<void> {
  const config: MigrationConfig = {
    // PostgreSQL
    databaseUrl: process.env.DATABASE_URL || '',
    
    // Polygon
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology',
    privateKey: process.env.DEPLOYER_PRIVATE_KEY || '',
    contractAddress: process.env.DOCUMENT_SIGNATURE_CONTRACT || '',
    
    // IPFS
    ipfsNodeUrl: process.env.IPFS_NODE_URL,
    ipfsGatewayUrl: process.env.IPFS_GATEWAY_URL,
    
    // Configurações
    batchSize: 5, // Processar 5 itens por batch
    maxRetries: 3,
    delayBetweenBatches: 2000 // 2 segundos entre batches
  };

  // Validar configuração
  if (!config.databaseUrl || !config.privateKey || !config.contractAddress) {
    throw new Error('Configuração incompleta. Verifique as variáveis de ambiente.');
  }

  const migration = new SignatureMigration(config);
  const result = await migration.migrate();

  // Log final
  console.log('\n🎉 MIGRAÇÃO CONCLUÍDA!');
  console.log('═'.repeat(50));
  console.log(`📄 Documentos migrados: ${result.migratedDocuments}/${result.totalDocuments}`);
  console.log(`✍️ Assinaturas migradas: ${result.migratedSignatures}/${result.totalSignatures}`);
  console.log(`⛽ Gas usado: ${result.gasCosts.totalGasUsed.toLocaleString()}`);
  console.log(`💰 Custo total: ${result.gasCosts.totalCostETH} ETH`);
  console.log(`❌ Erros: ${result.errors.length}`);
  console.log('═'.repeat(50));

  if (result.errors.length > 0) {
    console.log('\n❌ ERROS ENCONTRADOS:');
    result.errors.forEach((error, i) => {
      console.log(`${i + 1}. ${error}`);
    });
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  runMigration().catch(console.error);
}
