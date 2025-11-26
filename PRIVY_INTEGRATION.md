# Integração Privy - Blocktrust

## Visão Geral

Este documento descreve a integração da **Privy** no Blocktrust, substituindo a infraestrutura da Biconomy por uma solução mais moderna e simplificada de Account Abstraction.

## O Que Mudou

### ✅ Adicionado

- **@privy-io/react-auth**: SDK principal da Privy para autenticação e wallets
- **wagmi**: Biblioteca para interação com Ethereum
- **viem**: Cliente Ethereum moderno e type-safe
- **@tanstack/react-query**: Gerenciamento de estado assíncrono
- **PrivyProvider**: Componente wrapper que configura a Privy
- **PrivyAuthService**: Serviço para autenticação com wallet determinística
- **PrivyTransactionService**: Serviço para envio de transações

### ❌ Removido

- **Biconomy SDK**: Toda a infraestrutura da Biconomy foi removida
- **account-abstraction.service.ts**: Substituído pelos novos serviços da Privy
- Variáveis de ambiente da Biconomy (ver seção abaixo)

## Arquitetura

### Fluxo de Autenticação

```
1. Usuário faz verificação biométrica (Sumsub)
   ↓
2. bioHash é gerado
   ↓
3. Wallet determinística é criada a partir do bioHash (PBKDF2)
   ↓
4. Wallet é armazenada em memória (nunca persistida)
   ↓
5. Wallet é usada como signer para transações via Privy
```

### Componentes Principais

#### `PrivyProvider.tsx`
Configura o contexto da Privy com:
- Configuração de chains (Polygon Mainnet e Amoy Testnet)
- Aparência customizada (cores, logo, mensagens)
- Smart Wallets habilitadas
- Wagmi e React Query configurados

#### `privy-auth.service.ts`
Gerencia autenticação:
- `authenticateWithBiometrics()`: Gera wallet a partir do bioHash
- `getCurrentWallet()`: Obtém wallet em memória
- `signMessage()`: Assina mensagens com a wallet
- `connectToPrivy()`: Conecta wallet à Privy via SIWE
- `logout()`: Limpa wallet da memória

#### `privy-transaction.service.ts`
Gerencia transações:
- `sendTransaction()`: Envia transação usando wallet determinística
- `estimateGas()`: Estima custo de gas
- `sendBatchTransactions()`: Envia múltiplas transações
- `getTransactionStatus()`: Verifica status de transação
- `getBalance()`: Obtém saldo da carteira

## Configuração

### Variáveis de Ambiente

**Novas variáveis (adicionar ao `.env`):**

```bash
# Privy
VITE_PRIVY_APP_ID=your-privy-app-id

# Blockchain
VITE_CHAIN_ID=80002
VITE_POLYGON_RPC_URL=https://polygon-rpc.com
VITE_POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology

# Contratos
VITE_IDENTITY_NFT_ADDRESS=0x...
VITE_PROOF_REGISTRY_ADDRESS=0x...

# Wallet
VITE_WALLET_ITERATIONS=250000
VITE_WALLET_SALT=blocktrust-mainnet

# Sumsub
VITE_SUMSUB_API_URL=https://api.sumsub.com
VITE_SUMSUB_APP_TOKEN=your-token

# API
VITE_API_BASE_URL=https://api.blocktrust.com/api
```

**Variáveis removidas (não mais necessárias):**

```bash
# Biconomy (REMOVER)
REACT_APP_BICONOMY_API_KEY
REACT_APP_BICONOMY_PAYMASTER_API_KEY
REACT_APP_BICONOMY_BUNDLER_URL
REACT_APP_ENABLE_GASLESS_TRANSACTIONS
REACT_APP_MAX_GAS_SPONSORSHIP_PER_USER_DAY
REACT_APP_MAX_TRANSACTIONS_PER_DAY
REACT_APP_MAX_GAS_PER_TRANSACTION
```

### Dashboard da Privy

1. Acesse [https://dashboard.privy.io](https://dashboard.privy.io)
2. Crie um novo projeto ou selecione existente
3. Copie o **App ID** e adicione em `VITE_PRIVY_APP_ID`

#### Habilitar Smart Wallets

1. Vá em **Settings → Smart Wallets**
2. Ative **Enable Smart Wallets**
3. Selecione implementação (recomendado: **Safe**)

#### Configurar Gas Sponsorship

1. Vá em **Settings → Gas Sponsorship**
2. Selecione a rede (Polygon Mainnet ou Amoy)
3. Configure limites:
   - Max gas per transaction: 0.01 MATIC
   - Max transactions per user per day: 100
   - Max gas per user per day: 0.1 MATIC
4. Adicione endereços dos contratos a serem patrocinados:
   - `VITE_IDENTITY_NFT_ADDRESS`
   - `VITE_PROOF_REGISTRY_ADDRESS`

## Uso

### Autenticação

```typescript
import { PrivyAuthService } from './services/privy-auth.service';

// Após verificação biométrica no Sumsub
const bioHash = '...'; // Hash biométrico do Sumsub

// Autentica e gera wallet
const { wallet, address } = await PrivyAuthService.authenticateWithBiometrics(
  bioHash,
  userId // Identificador para rate limiting
);

console.log('Wallet criada:', address);
```

### Envio de Transação

```typescript
import { PrivyTransactionService } from './services/privy-transaction.service';
import { encodeFunctionData } from 'viem';

// Codifica chamada do contrato
const data = encodeFunctionData({
  abi: IdentityNFTABI,
  functionName: 'mintIdentity',
  args: [recipientAddress, tokenURI, bioHashProof],
});

// Envia transação
const result = await PrivyTransactionService.sendTransaction(
  contractAddress,
  data,
  '0' // value em ether
);

if (result.success) {
  console.log('Transação confirmada:', result.hash);
} else {
  console.error('Erro:', result.error);
}
```

### Logout

```typescript
import { PrivyAuthService } from './services/privy-auth.service';

// Remove wallet da memória
PrivyAuthService.logout();
```

## Segurança

### Wallet Determinística

- **Nunca armazenada**: A wallet é mantida apenas em memória durante a sessão
- **Recriável**: Pode ser regenerada a qualquer momento com o bioHash
- **Self-custodial**: Nenhuma chave privada é armazenada em servidor ou localStorage

### Rate Limiting

O `DeterministicWalletGenerator` implementa rate limiting:
- 5 tentativas por minuto
- Cooldown de 5 minutos se esgotar tentativas
- Proteção contra ataques de força bruta

### PBKDF2

- **Iterações**: 250.000 (produção) / 10.000 (desenvolvimento)
- **Salt**: Customizável por ambiente
- **Key Length**: 32 bytes (256 bits)

## Migração de Código Existente

### Antes (Biconomy)

```typescript
import { AccountAbstractionService } from './services/account-abstraction.service';

const service = new AccountAbstractionService();
await service.initializeProvider();

const result = await service.executeGaslessTransaction(
  signer,
  to,
  data,
  value
);
```

### Depois (Privy)

```typescript
import { PrivyAuthService } from './services/privy-auth.service';
import { PrivyTransactionService } from './services/privy-transaction.service';

// 1. Autentica com bioHash
await PrivyAuthService.authenticateWithBiometrics(bioHash, userId);

// 2. Envia transação
const result = await PrivyTransactionService.sendTransaction(to, data, value);
```

## Testes

### Testar Autenticação

```bash
# No console do navegador
import { PrivyAuthService } from './services/privy-auth.service';

const bioHash = 'a'.repeat(64); // Hash de teste
const result = await PrivyAuthService.authenticateWithBiometrics(bioHash, 'test-user');
console.log('Address:', result.address);
```

### Testar Transação

```bash
# Certifique-se de ter MATIC na wallet para gas
const balance = await PrivyTransactionService.getBalance(result.address);
console.log('Balance:', balance, 'MATIC');
```

## Troubleshooting

### Erro: "VITE_PRIVY_APP_ID não configurado"

**Solução**: Adicione a variável `VITE_PRIVY_APP_ID` no arquivo `.env`

### Erro: "Nenhuma wallet autenticada"

**Solução**: Chame `PrivyAuthService.authenticateWithBiometrics()` antes de enviar transações

### Erro: "Rate limit atingido"

**Solução**: Aguarde o tempo indicado na mensagem de erro antes de tentar novamente

### Transações falhando

**Possíveis causas**:
1. Saldo insuficiente de MATIC
2. Gas sponsorship não configurado no dashboard da Privy
3. Contrato não adicionado à lista de contratos patrocinados
4. RPC URL incorreta ou indisponível

## Próximos Passos

- [ ] Configurar gas sponsorship no dashboard da Privy
- [ ] Testar mint de Identity NFT com transação gasless
- [ ] Testar assinatura de documento
- [ ] Implementar tratamento de erros mais robusto
- [ ] Adicionar analytics de transações
- [ ] Implementar retry automático para transações falhadas

## Suporte

- **Documentação Privy**: https://docs.privy.io
- **Dashboard Privy**: https://dashboard.privy.io
- **Discord Privy**: https://discord.gg/privy

## Changelog

### v1.0.0 (2025-11-20)
- ✅ Instalação do SDK da Privy
- ✅ Criação do PrivyProvider
- ✅ Implementação do PrivyAuthService
- ✅ Implementação do PrivyTransactionService
- ✅ Remoção completa da Biconomy
- ✅ Atualização de variáveis de ambiente
- ✅ Documentação completa
