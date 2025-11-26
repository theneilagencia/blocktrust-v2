# Guia de Deploy - Smart Contracts Blocktrust v1.1

**Data**: 28 de outubro de 2025  
**Rede**: Polygon Mumbai (Testnet)  
**Contratos**: IdentityNFT, ProofRegistry, FailSafe

---

## 📋 Pré-requisitos

### 1. Ferramentas Necessárias

- **Carteira MetaMask** configurada para Polygon Mumbai
- **MATIC de teste** (obter em https://faucet.polygon.technology/)
- **Remix IDE** (https://remix.ethereum.org/) ou **Hardhat**
- **Toolblox** (https://toolblox.net/) - Opcional

### 2. Configuração da Rede

**Polygon Mumbai Testnet**

- **RPC URL**: `https://rpc-mumbai.maticvigil.com`
- **Chain ID**: `80001`
- **Currency Symbol**: `MATIC`
- **Block Explorer**: `https://mumbai.polygonscan.com`

---

## 🚀 Opção 1: Deploy Automatizado (Python)

### Passo 1: Instalar Dependências

```bash
cd /home/ubuntu/bts-blocktrust
pip3 install web3 py-solc-x
```

### Passo 2: Configurar Chave Privada

```bash
export DEPLOYER_PRIVATE_KEY=0x...  # Sua chave privada (NUNCA compartilhe!)
export POLYGON_RPC_URL=https://rpc-mumbai.maticvigil.com
```

### Passo 3: Executar Deploy

```bash
cd contracts
python3 deploy.py
```

### Passo 4: Verificar Resultados

O script irá:
- Compilar os 3 contratos
- Fazer deploy no Polygon Mumbai
- Configurar roles automaticamente
- Salvar endereços em `.env.contracts`
- Salvar ABIs em `*.abi.json`

---

## 🛠️ Opção 2: Deploy Manual (Remix IDE)

### Passo 1: Abrir Remix

1. Acesse https://remix.ethereum.org/
2. Crie uma nova workspace

### Passo 2: Importar Contratos

1. Copie os arquivos da pasta `contracts/`:
   - `IdentityNFT.sol`
   - `ProofRegistry.sol`
   - `FailSafe.sol`

2. Cole no Remix IDE

### Passo 3: Compilar Contratos

1. Vá para a aba **Solidity Compiler**
2. Selecione versão `0.8.20`
3. Ative **Optimization** (200 runs)
4. Compile cada contrato

### Passo 4: Deploy IdentityNFT

1. Vá para a aba **Deploy & Run Transactions**
2. Selecione **Injected Provider - MetaMask**
3. Conecte sua carteira MetaMask
4. Selecione contrato `IdentityNFT`
5. No campo **ADMIN**, insira seu endereço
6. Clique em **Deploy**
7. Confirme a transação no MetaMask
8. **Copie o endereço do contrato deployado**

### Passo 5: Deploy ProofRegistry

1. Selecione contrato `ProofRegistry`
2. No campo **IDENTITYCONTRACT**, cole o endereço do `IdentityNFT`
3. Clique em **Deploy**
4. Confirme a transação
5. **Copie o endereço do contrato deployado**

### Passo 6: Deploy FailSafe

1. Selecione contrato `FailSafe`
2. No campo **ADMIN**, insira seu endereço
3. No campo **IDENTITYCONTRACT**, cole o endereço do `IdentityNFT`
4. Clique em **Deploy**
5. Confirme a transação
6. **Copie o endereço do contrato deployado**

### Passo 7: Configurar Roles

#### 7.1. Conceder MINTER_ROLE

1. No contrato `IdentityNFT` deployado, expanda a função `grantRole`
2. **ROLE**: `0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6` (MINTER_ROLE)
3. **ACCOUNT**: Endereço do backend (ou seu endereço para testes)
4. Clique em **transact**
5. Confirme a transação

#### 7.2. Conceder CANCELER_ROLE ao FailSafe

1. No contrato `IdentityNFT` deployado, expanda a função `grantRole`
2. **ROLE**: `0x2e5c5ea1c61e8e5e1b5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e` (CANCELER_ROLE)
3. **ACCOUNT**: Endereço do contrato `FailSafe`
4. Clique em **transact**
5. Confirme a transação

#### 7.3. Conceder SECURITY_ROLE

1. No contrato `FailSafe` deployado, expanda a função `grantRole`
2. **ROLE**: `0x...` (SECURITY_ROLE - calcular com keccak256("SECURITY_ROLE"))
3. **ACCOUNT**: Endereço do backend (ou seu endereço para testes)
4. Clique em **transact**
5. Confirme a transação

---

## 🌐 Opção 3: Deploy via Toolblox

### Passo 1: Criar Projeto no Toolblox

1. Acesse https://toolblox.net/
2. Crie um novo projeto "Blocktrust Identity"
3. Selecione **Polygon Mumbai**

### Passo 2: Importar Contratos

1. Copie o código de `IdentityNFT.sol`
2. Cole no editor do Toolblox
3. Repita para `ProofRegistry.sol` e `FailSafe.sol`

### Passo 3: Configurar Workflows

Crie os seguintes workflows:

#### Workflow 1: mintIdentity

- **Contrato**: IdentityNFT
- **Função**: `mintIdentityNFT`
- **Entradas**:
  - `user` (address)
  - `tokenURIData` (string)
  - `previousId` (uint256)
- **Papel**: MINTER_ROLE

#### Workflow 2: cancelNFT

- **Contrato**: IdentityNFT
- **Função**: `cancelNFT`
- **Entradas**:
  - `tokenId` (uint256)
- **Papel**: CANCELER_ROLE

#### Workflow 3: registerProof

- **Contrato**: ProofRegistry
- **Função**: `registerProof`
- **Entradas**:
  - `docHash` (string)
  - `proofUrl` (string)
- **Papel**: Público (usuário)

#### Workflow 4: verifyProof

- **Contrato**: ProofRegistry
- **Função**: `verifyProof`
- **Entradas**:
  - `docHash` (string)
- **Papel**: Público (view)

#### Workflow 5: panicSign

- **Contrato**: FailSafe
- **Função**: `panicSign`
- **Entradas**:
  - `user` (address)
- **Papel**: SECURITY_ROLE

### Passo 4: Deploy via Toolblox

1. Clique em **Deploy**
2. Selecione **Polygon Mumbai**
3. Confirme as transações
4. **Copie os endereços dos contratos**

---

## 📝 Atualizar Backend

### Passo 1: Atualizar Variáveis de Ambiente

Adicione ao `.env` do Render:

```bash
IDENTITY_NFT_CONTRACT_ADDRESS=0x...
PROOF_REGISTRY_CONTRACT_ADDRESS=0x...
FAILSAFE_CONTRACT_ADDRESS=0x...
CHAIN_ID=80001
POLYGON_RPC_URL=https://rpc-mumbai.maticvigil.com
```

### Passo 2: Atualizar Código

Edite `backend/api/utils/nft.py`:

```python
IDENTITY_NFT_CONTRACT_ADDRESS = os.getenv('IDENTITY_NFT_CONTRACT_ADDRESS', '0x...')
PROOF_REGISTRY_CONTRACT_ADDRESS = os.getenv('PROOF_REGISTRY_CONTRACT_ADDRESS', '0x...')
```

### Passo 3: Fazer Deploy

```bash
git add .env contracts/
git commit -m "feat: SmartContracts Blocktrust v1.1 deployed"
git push render main
```

---

## 🧪 Testes Básicos

### Teste 1: Mint NFT

```javascript
// No Remix ou Toolblox
mintIdentityNFT(
  "0xUSER_ADDRESS",
  "ipfs://QmXXX...",
  0  // previousId = 0 (primeiro NFT)
)
```

**Resultado Esperado**: NFT #1 mintado, evento `MintingEvent` emitido

### Teste 2: Verificar NFT Ativo

```javascript
activeNFT("0xUSER_ADDRESS")
```

**Resultado Esperado**: Retorna `1` (ID do NFT)

### Teste 3: Registrar Prova

```javascript
registerProof(
  "abc123...",  // docHash
  "ipfs://QmYYY..."  // proofUrl
)
```

**Resultado Esperado**: Prova registrada, evento `ProofRegistered` emitido

### Teste 4: Verificar Prova

```javascript
verifyProof("abc123...")
```

**Resultado Esperado**: Retorna dados da prova

### Teste 5: Mint NFT #2 (Cancela #1)

```javascript
mintIdentityNFT(
  "0xUSER_ADDRESS",
  "ipfs://QmZZZ...",
  1  // previousId = 1 (NFT anterior)
)
```

**Resultado Esperado**: 
- NFT #1 cancelado (evento `CancelamentoEvent`)
- NFT #2 mintado (evento `MintingEvent`)

### Teste 6: Failsafe (Panic Sign)

```javascript
panicSign("0xUSER_ADDRESS")
```

**Resultado Esperado**:
- Evento `FailsafeEvent` emitido
- NFT #2 cancelado automaticamente

### Teste 7: Tentar Registrar Prova Após Panic

```javascript
registerProof("def456...", "ipfs://QmAAA...")
```

**Resultado Esperado**: ❌ Transação falha com erro "Identidade inativa"

---

## 📊 Verificação no PolygonScan

Após o deploy, verifique os contratos:

1. Acesse https://mumbai.polygonscan.com/
2. Cole o endereço do contrato
3. Verifique:
   - ✅ Transações de deploy
   - ✅ Eventos emitidos
   - ✅ Código do contrato
   - ✅ Roles configuradas

---

## 🔐 Segurança

### Boas Práticas

1. **NUNCA** compartilhe sua chave privada
2. **SEMPRE** use carteira de teste para Mumbai
3. **VERIFIQUE** os endereços antes de enviar transações
4. **TESTE** em Mumbai antes de ir para Mainnet
5. **AUDITE** os contratos antes de produção

### Roles Configuradas

| Role | Contrato | Descrição | Quem Possui |
|------|----------|-----------|-------------|
| `DEFAULT_ADMIN_ROLE` | IdentityNFT | Admin geral | Deployer |
| `MINTER_ROLE` | IdentityNFT | Pode mintar NFTs | Backend |
| `CANCELER_ROLE` | IdentityNFT | Pode cancelar NFTs | FailSafe |
| `SECURITY_ROLE` | FailSafe | Pode acionar panic | Backend |

---

## 📚 Referências

- [Polygon Mumbai Faucet](https://faucet.polygon.technology/)
- [Remix IDE](https://remix.ethereum.org/)
- [Toolblox](https://toolblox.net/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [PolygonScan Mumbai](https://mumbai.polygonscan.com/)

---

## ✅ Checklist de Deploy

- [ ] Contratos compilados sem erros
- [ ] IdentityNFT deployado
- [ ] ProofRegistry deployado
- [ ] FailSafe deployado
- [ ] MINTER_ROLE concedida ao backend
- [ ] CANCELER_ROLE concedida ao FailSafe
- [ ] SECURITY_ROLE concedida ao backend
- [ ] Endereços salvos no `.env`
- [ ] ABIs salvos em `*.abi.json`
- [ ] Testes básicos executados
- [ ] Contratos verificados no PolygonScan

---

**Status**: ✅ **Pronto para Deploy**

*Guia criado automaticamente por Manus AI Agent*

