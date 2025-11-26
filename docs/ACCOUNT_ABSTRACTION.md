# Account Abstraction & Gasless Transactions

Este documento descreve a implementação de Account Abstraction (ERC-4337) usando Biconomy para transações gasless na plataforma Blocktrust.

## Visão Geral

A Account Abstraction permite que os usuários interajam com contratos inteligentes sem necessitar de MATIC para pagar taxas de gas. Isso é especialmente útil para:

- **Onboarding de novos usuários**: Não precisam comprar MATIC para começar
- **Melhor UX**: Transações transparentes sem complicações de gas
- **Redução de custos**: Sponsorship de transações pela plataforma

## Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Biconomy      │    │   Polygon       │
│                 │    │   Infrastructure│    │   Network       │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ React Hooks     │◄──►│ Smart Account   │◄──►│ DocumentSig.    │
│ useGasless      │    │ Bundler         │    │ IdentityNFT     │
│ UI Components   │    │ Paymaster       │    │ Contracts       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Configuração

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis ao seu arquivo `.env.polygon`:

```bash
# Account Abstraction & Gasless Transactions
REACT_APP_BICONOMY_API_KEY=your_biconomy_api_key
REACT_APP_BICONOMY_PAYMASTER_API_KEY=your_paymaster_api_key

# Biconomy Bundler URLs
REACT_APP_BICONOMY_BUNDLER_URL_AMOY=https://bundler.biconomy.io/api/v2/80002/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44
REACT_APP_BICONOMY_BUNDLER_URL_MAINNET=https://bundler.biconomy.io/api/v2/137/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44

# Smart Account Configuration
REACT_APP_ENABLE_GASLESS_TRANSACTIONS=true
REACT_APP_GAS_SPONSORSHIP_POLICY=strict
REACT_APP_MAX_GAS_SPONSORSHIP_PER_USER_DAY=0.1
REACT_APP_SPONSORED_CONTRACTS=DOCUMENT_SIGNATURE,IDENTITY_NFT
```

### 2. Configuração do Biconomy Dashboard

1. Acesse https://dashboard.biconomy.io
2. Crie um novo projeto
3. Configure as seguintes opções:
   - **Network**: Polygon (137) ou Amoy Testnet (80002)
   - **Paymaster Policy**: Configure limites de sponsorship
   - **Sponsored Contracts**: Adicione endereços dos contratos DocumentSignature e IdentityNFT

## Uso

### 1. Service Layer

```typescript
import { accountAbstractionService } from './services/account-abstraction.service';

// Verificar disponibilidade
if (accountAbstractionService.isAvailable()) {
  // Inicializar provider
  await accountAbstractionService.initializeProvider();
  
  // Executar transação gasless
  const result = await accountAbstractionService.executeGaslessTransaction(
    signer,
    contractAddress,
    callData,
    value
  );
}
```

### 2. React Hooks

```typescript
import { useGaslessTransactions } from './hooks/useGasless';

function MyComponent() {
  const { 
    executeGaslessTransaction,
    estimateGas,
    isAvailable,
    canExecuteTransactions 
  } = useGaslessTransactions(signer);

  const handleTransaction = async () => {
    if (!canExecuteTransactions) return;
    
    const result = await executeGaslessTransaction(
      contractAddress,
      callData
    );
    
    if (result.success) {
      console.log('Transaction successful:', result.transactionHash);
    }
  };
}
```

### 3. Componentes UI

```typescript
import { GaslessTransaction } from './components/GaslessTransaction';

function App() {
  return (
    <GaslessTransaction
      signer={signer}
      onTransactionComplete={(result) => {
        console.log('Transaction completed:', result);
      }}
      showAnalytics={true}
    />
  );
}
```

## Integração com Contratos Existentes

### Document Signature

```typescript
// Criar documento gasless
const createDocumentGasless = async (file: File, title: string, description: string) => {
  // 1. Upload IPFS
  const ipfsHash = await ipfsService.uploadDocument(file, metadata);
  
  // 2. Preparar call data
  const contractInterface = new ethers.Interface(DOCUMENT_SIGNATURE_ABI);
  const callData = contractInterface.encodeFunctionData('createDocument', [
    ipfsHash, title, description
  ]);
  
  // 3. Executar gasless
  return await gaslessService.executeGaslessTransaction(
    contractAddress,
    callData
  );
};

// Assinar documento gasless
const signDocumentGasless = async (documentId: number, identityTokenId: number) => {
  // 1. Criar assinatura EIP-712
  const signature = await signer.signTypedData(domain, types, message);
  
  // 2. Preparar call data
  const callData = contractInterface.encodeFunctionData('signDocument', [
    documentId, identityTokenId, metadataHash, signature
  ]);
  
  // 3. Executar gasless
  return await gaslessService.executeGaslessTransaction(
    contractAddress,
    callData
  );
};
```

## Políticas de Sponsorship

### 1. Contratos Elegíveis

Por padrão, apenas transações para os seguintes contratos são patrocinadas:

- **DocumentSignature**: Criação e assinatura de documentos
- **IdentityNFT**: Verificação de identidade

### 2. Limites

- **Por usuário**: 0.1 MATIC por dia
- **Por transação**: Máximo de 0.01 MATIC
- **Cooldown**: 10 segundos entre transações gasless

### 3. Fallback

Se uma transação gasless falhar:
1. O sistema automaticamente tenta novamente
2. Se falhar novamente, fallback para transação regular
3. Usuário é notificado sobre custos de gas

## Monitoramento e Analytics

### 1. Métricas Coletadas

```typescript
const analytics = await gaslessService.getGasUsageAnalytics('week');
// {
//   totalTransactions: 150,
//   totalGasSponsored: "2.35",
//   totalGasSaved: "2.35", 
//   sponsorshipRate: 0.87
// }
```

### 2. Dashboard de Monitoramento

- **Total de transações patrocinadas**
- **MATIC economizado pelos usuários**
- **Taxa de sucesso de sponsorship**
- **Usuários mais ativos**

## Segurança

### 1. Validações

- **Rate limiting**: Máximo de 10 transações por minuto por usuário
- **Contract whitelisting**: Apenas contratos aprovados
- **Value limits**: Transações com value > 0 rejeitadas para sponsorship
- **Signature validation**: Todas as assinaturas EIP-712 validadas

### 2. Proteções Anti-Spam

- **Cooldown periods**: Evita spam de transações
- **Daily limits**: Limites diários por usuário
- **Behavioral analysis**: Detecção de padrões suspeitos

## Testes

### 1. Executar Testes

```bash
# Testes específicos de gasless
npm run test:gasless

# Testes completos
npm run test:all
```

### 2. Validar Configuração

```bash
# Verificar configuração do Biconomy
npm run validate:gasless
```

## Troubleshooting

### 1. Problemas Comuns

**Erro: "Gasless transactions not available"**
- Verificar configuração de environment variables
- Confirmar que o projeto Biconomy está ativo
- Verificar saldo do paymaster

**Erro: "Transaction sponsored failed"**
- Verificar se o contrato está na whitelist
- Confirmar que não excedeu limites diários
- Verificar se a rede está correta

**Fallback para transação regular**
- Normal quando sponsorship não está disponível
- Usuário será notificado sobre custos de gas

### 2. Debug

```typescript
// Verificar status da configuração
const validation = await accountAbstractionService.validateConfiguration();
console.log(validation);

// Estimar gas antes da transação
const estimate = await accountAbstractionService.estimateGasForTransaction(
  from, to, data, value
);
console.log(estimate);
```

## Roadmap

### Próximas Funcionalidades

1. **Batch Transactions**: Múltiplas operações em uma única transação
2. **Session Keys**: Autorizações temporárias para ações específicas
3. **Social Recovery**: Recuperação de smart account via amigos/família
4. **Cross-chain Support**: Suporte para outras redes além da Polygon

### Otimizações Planejadas

1. **Gas Optimization**: Redução adicional de custos de gas
2. **UX Improvements**: Interface ainda mais fluída
3. **Advanced Analytics**: Métricas mais detalhadas
4. **Auto-refill**: Recarga automática do paymaster

## Suporte

Para dúvidas ou problemas:

1. **Documentação Biconomy**: https://docs.biconomy.io
2. **Discord Biconomy**: https://discord.gg/biconomy
3. **GitHub Issues**: [Link do repositório]

## Conclusão

A implementação de Account Abstraction na Blocktrust oferece uma experiência de usuário superior, removendo a complexidade das taxas de gas e permitindo que os usuários se concentrem no que realmente importa: assinar e gerenciar documentos de forma segura e descentralizada.

Com sponsorship inteligente e fallbacks robustos, garantimos que a plataforma seja acessível tanto para usuários iniciantes quanto experientes, mantendo a segurança e descentralização do blockchain.
