import { ethers } from "hardhat";
import fs from "fs/promises";
import path from "path";

interface DeploymentConfig {
  network: string;
  identityNFTAddress?: string;
  gasPrice?: string;
  gasLimit?: number;
}

interface DeploymentResult {
  network: string;
  chainId: number;
  identityNFT: string;
  documentSignature: string;
  deployerAddress: string;
  transactionHashes: {
    identityNFT?: string;
    documentSignature: string;
  };
  gasUsed: {
    identityNFT?: number;
    documentSignature: number;
    total: number;
  };
  costs: {
    totalETH: string;
    totalUSD?: string;
  };
}

/**
 * Deploy dos contratos na Polygon
 */
async function deployContracts(config: DeploymentConfig): Promise<DeploymentResult> {
  console.log(`🚀 Iniciando deploy na rede: ${config.network}`);
  console.log('═'.repeat(60));

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log(`📡 Rede: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`👤 Deployer: ${deployer.address}`);
  
  const balance = await deployer.getBalance();
  console.log(`💰 Saldo: ${ethers.utils.formatEther(balance)} ${network.name === 'polygon' ? 'MATIC' : 'ETH'}`);
  console.log('');

  const result: DeploymentResult = {
    network: config.network,
    chainId: network.chainId,
    identityNFT: config.identityNFTAddress || '',
    documentSignature: '',
    deployerAddress: deployer.address,
    transactionHashes: {
      documentSignature: ''
    },
    gasUsed: {
      documentSignature: 0,
      total: 0
    },
    costs: {
      totalETH: '0'
    }
  };

  try {
    // 1. Deploy IdentityNFT (se não fornecido)
    let identityNFTAddress = config.identityNFTAddress;
    
    if (!identityNFTAddress) {
      console.log('📄 Deployando IdentityNFT...');
      
      const IdentityNFT = await ethers.getContractFactory("IdentityNFT");
      const identityNFT = await IdentityNFT.deploy({
        gasPrice: config.gasPrice,
        gasLimit: config.gasLimit
      });
      
      await identityNFT.deployed();
      identityNFTAddress = identityNFT.address;
      result.identityNFT = identityNFTAddress;
      
      const deployTx = identityNFT.deployTransaction;
      result.transactionHashes.identityNFT = deployTx.hash;
      
      const receipt = await deployTx.wait();
      result.gasUsed.identityNFT = receipt.gasUsed.toNumber();
      
      console.log(`✅ IdentityNFT deployed: ${identityNFTAddress}`);
      console.log(`   📋 Transaction: ${deployTx.hash}`);
      console.log(`   ⛽ Gas used: ${receipt.gasUsed.toLocaleString()}`);
      console.log('');
    } else {
      result.identityNFT = identityNFTAddress;
      console.log(`🔗 Usando IdentityNFT existente: ${identityNFTAddress}`);
      console.log('');
    }

    // 2. Deploy DocumentSignature
    console.log('📄 Deployando DocumentSignature...');
    
    const DocumentSignature = await ethers.getContractFactory("DocumentSignature");
    const documentSignature = await DocumentSignature.deploy(
      identityNFTAddress,
      {
        gasPrice: config.gasPrice,
        gasLimit: config.gasLimit
      }
    );
    
    await documentSignature.deployed();
    result.documentSignature = documentSignature.address;
    
    const deployTx = documentSignature.deployTransaction;
    result.transactionHashes.documentSignature = deployTx.hash;
    
    const receipt = await deployTx.wait();
    result.gasUsed.documentSignature = receipt.gasUsed.toNumber();
    
    console.log(`✅ DocumentSignature deployed: ${documentSignature.address}`);
    console.log(`   📋 Transaction: ${deployTx.hash}`);
    console.log(`   ⛽ Gas used: ${receipt.gasUsed.toLocaleString()}`);
    console.log('');

    // 3. Calcular custos totais
    result.gasUsed.total = (result.gasUsed.identityNFT || 0) + result.gasUsed.documentSignature;
    
    const gasPrice = await ethers.provider.getGasPrice();
    const totalCost = gasPrice.mul(result.gasUsed.total);
    result.costs.totalETH = ethers.utils.formatEther(totalCost);
    
    console.log('💰 CUSTOS TOTAIS:');
    console.log(`   ⛽ Gas total: ${result.gasUsed.total.toLocaleString()}`);
    console.log(`   💎 Custo: ${result.costs.totalETH} ${network.name === 'polygon' ? 'MATIC' : 'ETH'}`);
    console.log('');

    // 4. Verificar contratos
    console.log('🔍 Verificando contratos...');
    
    // Verificar se IdentityNFT está funcionando
    const identityContract = await ethers.getContractAt("IdentityNFT", identityNFTAddress);
    const name = await identityContract.name();
    console.log(`✅ IdentityNFT nome: ${name}`);
    
    // Verificar se DocumentSignature está funcionando
    const docContract = await ethers.getContractAt("DocumentSignature", documentSignature.address);
    const stats = await docContract.getStats();
    console.log(`✅ DocumentSignature stats: ${stats[0]} docs, ${stats[1]} assinaturas`);
    
    // Verificar integração
    const linkedIdentityNFT = await docContract.identityNFT();
    console.log(`✅ Integração verificada: ${linkedIdentityNFT === identityNFTAddress}`);
    console.log('');

    console.log('✅ DEPLOY CONCLUÍDO COM SUCESSO!');

  } catch (error) {
    console.error('❌ Erro no deploy:', error);
    throw error;
  }

  return result;
}

/**
 * Salvar resultados do deploy
 */
async function saveDeploymentResults(result: DeploymentResult): Promise<void> {
  const timestamp = new Date().toISOString();
  const filename = `deployment-${result.network}-${Date.now()}.json`;
  const filepath = path.join(process.cwd(), 'deployments', filename);
  
  // Criar diretório se não existir
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  
  const deploymentData = {
    timestamp,
    ...result,
    explorerLinks: {
      identityNFT: getExplorerLink(result.chainId, result.identityNFT),
      documentSignature: getExplorerLink(result.chainId, result.documentSignature),
      identityNFTTx: result.transactionHashes.identityNFT 
        ? getExplorerLink(result.chainId, result.transactionHashes.identityNFT, 'tx')
        : undefined,
      documentSignatureTx: getExplorerLink(result.chainId, result.transactionHashes.documentSignature, 'tx')
    }
  };
  
  await fs.writeFile(filepath, JSON.stringify(deploymentData, null, 2));
  console.log(`📄 Resultados salvos em: ${filepath}`);
}

/**
 * Gerar arquivo .env com endereços dos contratos
 */
async function generateEnvFile(result: DeploymentResult): Promise<void> {
  const envContent = `
# Contratos Polygon - ${result.network.toUpperCase()}
NEXT_PUBLIC_IDENTITY_NFT_${result.network.toUpperCase()}=${result.identityNFT}
NEXT_PUBLIC_DOCUMENT_SIGNATURE_${result.network.toUpperCase()}=${result.documentSignature}

# RPC URLs
POLYGON_${result.network.toUpperCase()}_RPC_URL=${getRpcUrl(result.chainId)}

# Explorer URLs
${result.network.toUpperCase()}_EXPLORER_URL=${getExplorerBaseUrl(result.chainId)}

# Deployed at: ${new Date().toISOString()}
# Chain ID: ${result.chainId}
# Network: ${result.network}
`;

  const envPath = path.join(process.cwd(), `.env.${result.network}`);
  await fs.writeFile(envPath, envContent.trim());
  console.log(`📄 Arquivo .env gerado: ${envPath}`);
}

/**
 * Utilitários
 */
function getExplorerLink(chainId: number, address: string, type: 'address' | 'tx' = 'address'): string {
  const baseUrl = getExplorerBaseUrl(chainId);
  return `${baseUrl}/${type}/${address}`;
}

function getExplorerBaseUrl(chainId: number): string {
  switch (chainId) {
    case 137: return 'https://polygonscan.com';
    case 80002: return 'https://amoy.polygonscan.com';
    case 80001: return 'https://mumbai.polygonscan.com';
    default: return 'https://etherscan.io';
  }
}

function getRpcUrl(chainId: number): string {
  switch (chainId) {
    case 137: return 'https://polygon-rpc.com';
    case 80002: return 'https://rpc-amoy.polygon.technology';
    case 80001: return 'https://rpc-mumbai.maticvigil.com';
    default: return '';
  }
}

/**
 * Função principal
 */
async function main() {
  const networkName = process.env.HARDHAT_NETWORK || 'hardhat';
  
  // Configuração baseada na rede
  const config: DeploymentConfig = {
    network: networkName
  };

  // Configurações específicas por rede
  if (networkName === 'polygon') {
    config.gasPrice = ethers.utils.parseUnits('30', 'gwei').toString();
    config.gasLimit = 6000000;
  } else if (networkName === 'amoy') {
    config.gasPrice = ethers.utils.parseUnits('30', 'gwei').toString();
    config.gasLimit = 6000000;
  }

  // Se fornecido, usar IdentityNFT existente
  if (process.env.IDENTITY_NFT_ADDRESS) {
    config.identityNFTAddress = process.env.IDENTITY_NFT_ADDRESS;
    console.log(`🔗 Usando IdentityNFT existente: ${config.identityNFTAddress}`);
  }

  try {
    console.log('🏗️ BLOCKTRUST - DEPLOY POLYGON');
    console.log('═'.repeat(60));
    
    const result = await deployContracts(config);
    
    await saveDeploymentResults(result);
    await generateEnvFile(result);
    
    console.log('');
    console.log('🎉 DEPLOY FINALIZADO!');
    console.log('═'.repeat(60));
    console.log('📋 RESUMO:');
    console.log(`   🔗 IdentityNFT: ${result.identityNFT}`);
    console.log(`   🔗 DocumentSignature: ${result.documentSignature}`);
    console.log(`   ⛽ Gas usado: ${result.gasUsed.total.toLocaleString()}`);
    console.log(`   💰 Custo total: ${result.costs.totalETH} ${networkName === 'polygon' ? 'MATIC' : 'ETH'}`);
    console.log('');
    console.log('🔍 LINKS DO EXPLORER:');
    console.log(`   IdentityNFT: ${getExplorerLink(result.chainId, result.identityNFT)}`);
    console.log(`   DocumentSignature: ${getExplorerLink(result.chainId, result.documentSignature)}`);
    console.log('');
    console.log('📝 PRÓXIMOS PASSOS:');
    console.log('   1. Atualize o arquivo .env com os endereços dos contratos');
    console.log('   2. Execute os testes de integração');
    console.log('   3. Configure o frontend com os novos endereços');
    console.log('   4. Execute a migração dos dados do PostgreSQL');

  } catch (error) {
    console.error('❌ Falha no deploy:', error);
    process.exit(1);
  }
}

// Executar o deploy
if (require.main === module) {
  main().catch(console.error);
}

export { deployContracts, DeploymentResult, DeploymentConfig };
