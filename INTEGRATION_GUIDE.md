# Guia de Integração - Blocktrust com Privy

Este documento fornece instruções para desenvolvedores sobre como usar os novos serviços e hooks da Privy no Blocktrust.

## 📚 Índice

1. [Arquitetura](#arquitetura)
2. [Hooks Disponíveis](#hooks-disponíveis)
3. [Componentes UI](#componentes-ui)
4. [Exemplos de Uso](#exemplos-de-uso)
5. [Migração de Código Existente](#migração-de-código-existente)

---

## Arquitetura

### Fluxo de Autenticação

```
Usuário → Sumsub KYC → bioHash gerado → Wallet Determinística criada → Privy (opcional)
```

### Camadas

1. **Serviços** (`src/services/`)
   - `privy-auth.service.ts`: Autenticação com wallet determinística
   - `privy-transaction.service.ts`: Envio de transações
   - `wallet-generator.ts`: Geração determinística (mantido)

2. **Hooks** (`src/hooks/`)
   - `useBlocktrustAuth`: Hook para autenticação
   - `useBlocktrustTransaction`: Hook para transações

3. **Componentes UI** (`src/components/ui/`)
   - `Button`: Botão com variantes BTS
   - `Card`: Card com subcomponentes
   - `Input`: Input com validação

---

## Hooks Disponíveis

### `useBlocktrustAuth`

Hook para gerenciar autenticação com wallet determinística.

**Estado**:
```typescript
{
  wallet: ethers.Wallet | null;
  address: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
```

**Métodos**:
- `authenticateWithBioHash(bioHash, userId)`: Autentica com bioHash
- `disconnect()`: Desconecta e limpa wallet
- `signMessage(message)`: Assina mensagem
- `connectToPrivy(domain, chainId)`: Conecta à Privy via SIWE
- `clearError()`: Limpa erro

**Exemplo**:
```typescript
import { useBlocktrustAuth } from '../hooks';

function MyComponent() {
  const { 
    isAuthenticated, 
    address, 
    authenticateWithBioHash,
    error 
  } = useBlocktrustAuth();

  const handleAuth = async (bioHash: string) => {
    try {
      await authenticateWithBioHash(bioHash, 'user-123');
      console.log('Autenticado!', address);
    } catch (err) {
      console.error('Erro:', error);
    }
  };

  return (
    <div>
      {isAuthenticated ? (
        <p>Conectado: {address}</p>
      ) : (
        <button onClick={() => handleAuth('...')}>Autenticar</button>
      )}
    </div>
  );
}
```

---

### `useBlocktrustTransaction`

Hook para gerenciar transações.

**Estado**:
```typescript
{
  isLoading: boolean;
  error: string | null;
  txHash: string | null;
  receipt: any | null;
}
```

**Métodos**:
- `sendTransaction(to, data, value)`: Envia transação
- `sendBatchTransactions(transactions)`: Envia múltiplas transações
- `getTransactionStatus(txHash)`: Obtém status
- `getBalance(address)`: Obtém saldo
- `estimateGas(from, to, data, value)`: Estima gas
- `clearTransaction()`: Limpa estado
- `clearError()`: Limpa erro

**Exemplo**:
```typescript
import { useBlocktrustTransaction } from '../hooks';
import { encodeFunctionData } from 'viem';

function MintNFT() {
  const { 
    sendTransaction, 
    isLoading, 
    txHash, 
    error 
  } = useBlocktrustTransaction();

  const handleMint = async () => {
    const data = encodeFunctionData({
      abi: IdentityNFTABI,
      functionName: 'mintIdentity',
      args: [recipientAddress, tokenURI, bioHashProof],
    });

    try {
      const result = await sendTransaction(
        contractAddress,
        data,
        '0' // value
      );

      if (result.success) {
        console.log('NFT mintado!', txHash);
      }
    } catch (err) {
      console.error('Erro:', error);
    }
  };

  return (
    <button onClick={handleMint} disabled={isLoading}>
      {isLoading ? 'Mintando...' : 'Mintar NFT'}
    </button>
  );
}
```

---

## Componentes UI

### Button

```typescript
import { Button } from '../components/ui';

<Button variant="primary" size="md" fullWidth>
  Clique Aqui
</Button>

// Variantes: primary, secondary, outline, ghost, danger
// Tamanhos: sm, md, lg
```

### Card

```typescript
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui';

<Card variant="elevated" padding="lg">
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descrição</CardDescription>
  </CardHeader>
  <CardContent>
    Conteúdo
  </CardContent>
  <CardFooter>
    <Button>Ação</Button>
  </CardFooter>
</Card>

// Variantes: default, elevated, outlined
// Padding: none, sm, md, lg
```

### Input

```typescript
import { Input } from '../components/ui';

<Input
  label="Email"
  type="email"
  placeholder="seu@email.com"
  error={errors.email}
  helperText="Digite seu email"
  fullWidth
/>
```

---

## Exemplos de Uso

### Exemplo 1: Fluxo Completo de KYC + Mint NFT

```typescript
import { useBlocktrustAuth, useBlocktrustTransaction } from '../hooks';
import { Button, Card, CardContent } from '../components/ui';
import { encodeFunctionData } from 'viem';

function KYCFlow() {
  const auth = useBlocktrustAuth();
  const tx = useBlocktrustTransaction();
  const [bioHash, setBioHash] = useState('');

  // 1. Após KYC aprovado, recebe bioHash
  const handleKYCComplete = async (bioHashFromSumsub: string) => {
    setBioHash(bioHashFromSumsub);
    
    // 2. Autentica com bioHash
    await auth.authenticateWithBioHash(bioHashFromSumsub, userId);
  };

  // 3. Minta Identity NFT
  const handleMintNFT = async () => {
    const data = encodeFunctionData({
      abi: IdentityNFTABI,
      functionName: 'mintIdentity',
      args: [auth.address, tokenURI, bioHash],
    });

    const result = await tx.sendTransaction(
      import.meta.env.VITE_IDENTITY_NFT_ADDRESS,
      data
    );

    if (result.success) {
      console.log('Identity NFT mintado!', tx.txHash);
    }
  };

  return (
    <Card>
      <CardContent>
        {!auth.isAuthenticated ? (
          <div>
            <p>Complete o KYC primeiro</p>
            {/* Componente Sumsub aqui */}
          </div>
        ) : (
          <div>
            <p>Wallet: {auth.address}</p>
            <Button 
              onClick={handleMintNFT} 
              loading={tx.isLoading}
            >
              Mintar Identity NFT
            </Button>
            {tx.txHash && (
              <p>Transação: {tx.txHash}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Exemplo 2: Assinatura de Documento

```typescript
import { useBlocktrustAuth, useBlocktrustTransaction } from '../hooks';
import { Button } from '../components/ui';

function SignDocument({ documentHash }: { documentHash: string }) {
  const auth = useBlocktrustAuth();
  const tx = useBlocktrustTransaction();

  const handleSign = async () => {
    // 1. Assina o hash do documento
    const signature = await auth.signMessage(documentHash);

    // 2. Registra no contrato
    const data = encodeFunctionData({
      abi: ProofRegistryABI,
      functionName: 'registerProof',
      args: [documentHash, signature],
    });

    const result = await tx.sendTransaction(
      import.meta.env.VITE_PROOF_REGISTRY_ADDRESS,
      data
    );

    if (result.success) {
      console.log('Documento assinado e registrado!');
    }
  };

  return (
    <Button 
      onClick={handleSign} 
      loading={tx.isLoading}
      disabled={!auth.isAuthenticated}
    >
      Assinar Documento
    </Button>
  );
}
```

### Exemplo 3: Verificar Saldo

```typescript
import { useEffect, useState } from 'react';
import { useBlocktrustAuth, useBlocktrustTransaction } from '../hooks';

function WalletBalance() {
  const { address, isAuthenticated } = useBlocktrustAuth();
  const { getBalance } = useBlocktrustTransaction();
  const [balance, setBalance] = useState('0');

  useEffect(() => {
    if (isAuthenticated && address) {
      getBalance(address).then(setBalance);
    }
  }, [isAuthenticated, address]);

  return (
    <div>
      {isAuthenticated && (
        <p>Saldo: {balance} MATIC</p>
      )}
    </div>
  );
}
```

---

## Migração de Código Existente

### Antes (Biconomy)

```typescript
// ❌ Código antigo
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
// ✅ Código novo
import { useBlocktrustAuth, useBlocktrustTransaction } from '../hooks';

function MyComponent() {
  const auth = useBlocktrustAuth();
  const tx = useBlocktrustTransaction();

  const handleTransaction = async () => {
    // Autentica se necessário
    if (!auth.isAuthenticated) {
      await auth.authenticateWithBioHash(bioHash, userId);
    }

    // Envia transação
    const result = await tx.sendTransaction(to, data, value);
  };

  return <button onClick={handleTransaction}>Enviar</button>;
}
```

---

## Cores do BTS Design System

Use as classes Tailwind configuradas:

```typescript
// Primary
bg-primary-blueHighlight  // #1B5AB4
bg-primary-blue           // #1B3857

// Secondary
bg-secondary-blue505      // #63C9F3
bg-secondary-blueC04      // #2A7BA1

// Feedback
bg-success-500            // #2E8B2E
bg-warning-500            // #FFD700
bg-error-500              // #E63939
bg-info-500               // #0C80A5

// Text
text-text-primary         // #000000
text-text-secondary       // #333333
text-text-link            // #1B5AB4

// Shadows
shadow-bts                // Shadow BTS padrão
shadow-bts-lg             // Shadow BTS grande
```

---

## Troubleshooting

### Erro: "Nenhuma wallet autenticada"

**Causa**: Tentou enviar transação sem autenticar primeiro.

**Solução**: Chame `authenticateWithBioHash()` antes.

### Erro: "Rate limit atingido"

**Causa**: Muitas tentativas de geração de wallet.

**Solução**: Aguarde o tempo indicado na mensagem.

### Transação falhando

**Possíveis causas**:
1. Saldo insuficiente de MATIC
2. Gas sponsorship não configurado
3. Contrato não na lista de patrocínio
4. RPC URL incorreta

**Solução**: Verifique configurações no Privy Dashboard.

---

## Suporte

- **Documentação Privy**: https://docs.privy.io
- **Dashboard Privy**: https://dashboard.privy.io
- **Documentação Blocktrust**: Ver `PRIVY_INTEGRATION.md`

---

**Última atualização**: 2025-11-20
