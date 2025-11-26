# DIAGNÓSTICO TÉCNICO COMPLETO - BLOCKTRUST V2

## 1. ARQUITETURA GERAL DO SISTEMA

### Stack Tecnológico
- **Backend**: Flask 3.0.0 (Python 3.11+) + PostgreSQL
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Blockchain**: Polygon (Amoy Testnet 80002 / Mainnet 137)
- **Smart Contracts**: Solidity 0.8.20 + Hardhat
- **Autenticação**: Privy (substituiu Biconomy)
- **KYC**: Sumsub WebSDK
- **Criptografia**: Web3.py, Ethers.js v6, CryptoJS

### Tamanho do Código
- Python Backend: 10.223 linhas
- TypeScript/React Frontend: 11.108 linhas
- Solidity Smart Contracts: 889 linhas
- **Total**: ~29.203 linhas

---

## 2. FLUXOS CRÍTICOS DO SISTEMA

### Fluxo 1: Biometria → Wallet Determinística → NFT Soulbound

```
Usuário → Sumsub WebSDK → bioHash → PBKDF2 → Wallet Determinística → IdentityNFT
```

1. **Captura Biométrica**: Usuário captura biometria via Sumsub WebSDK (rosto, documento)
2. **BioHash Gerado**: Sumsub retorna hash único e imutável do usuário
3. **Derivação Determinística**: Frontend gera wallet usando PBKDF2:
   - Salt: `VITE_WALLET_SALT` (diferente por rede)
   - Iterações: `VITE_WALLET_ITERATIONS` (250.000 produção, 10.000 dev)
   - Resultado: Endereço Ethereum determinístico
4. **Minting NFT**: Backend minta IdentityNFT soulbound para esse endereço
5. **Armazenamento**: Wallet permanece **apenas em memória** durante sessão (nunca persistido)
6. **Recuperação**: Mesma biometria sempre gera mesma wallet

**Arquivo Principal**: `frontend/src/services/wallet-generator.ts`

### Fluxo 2: Assinatura de Documentos (Blockchain + PGP)

```
Upload Doc → SHA-256 Local → IPFS → ProofRegistry → Blockchain
```

1. **Upload**: Usuário faz upload do documento
2. **Hash Local**: Frontend calcula SHA-256 do arquivo (nunca enviado)
3. **IPFS**: Documento armazenado em IPFS (opcional)
4. **Registro Blockchain**: Assinatura registrada via ProofRegistry smart contract
5. **Assinatura Dupla**: Suporta PGP + blockchain simultaneamente
6. **Revogação**: Pode revogar assinatura mantendo histórico

**Arquivos**: `backend/api/routes/signature_routes.py`, `contracts/ProofRegistry.sol`

### Fluxo 3: Transações Gasless (Privy + Account Abstraction)

```
Ação do Usuário → Privy Smart Account → Paymaster → Polygon
```

1. **Detecção**: Sistema verifica se ação é elegível para sponsorship
2. **UserOperation**: Se elegível, cria UserOperation (ERC-4337)
3. **Paymaster**: Privy paymaster patrocina gas fees
4. **Execução**: Transação enviada sem custo para usuário
5. **Fallback**: Se não elegível, transação regular (usuário paga gas)
6. **Analytics**: Sistema rastreia gas economizado

**Arquivos**: `frontend/src/services/privy-transaction.service.ts`

### Fluxo 4: Multi-Factor Authentication (TOTP + Backup Codes)

```
Email/Senha → TOTP (6 dígitos) → Backup Codes (8 códigos) → Acesso
```

1. **Setup**: Usuário escaneia QR Code com Google Authenticator/Authy
2. **Secret**: Backend gera secret TOTP criptografado
3. **Backup Codes**: 8 códigos gerados para recuperação
4. **Login**: Email + senha + código TOTP de 6 dígitos
5. **Validação**: Backend verifica com pyotp
6. **Rate Limiting**: Máximo 5 tentativas por minuto

**Arquivo**: `backend/api/services/mfa_service.py`

---

## 3. INTEGRAÇÕES EXTERNAS MAPEADAS

### Sumsub (KYC/Biometria)
| Aspecto | Detalhe |
|---------|---------|
| **Endpoint** | api.sumsub.com |
| **Variáveis** | SUMSUB_APP_TOKEN, SUMSUB_SECRET_KEY |
| **Fluxo** | Frontend: WebSDK → Backend: Validação → bioHash |
| **Retorno** | bioHash único + applicant_id |
| **Arquivo** | `backend/api/utils/sumsub.py` |
| **Status** | ✅ Integrado |

### Privy (Account Abstraction)
| Aspecto | Detalhe |
|---------|---------|
| **SDK** | @privy-io/react-auth v3.7.0 |
| **Variável** | VITE_PRIVY_APP_ID |
| **Fluxo** | PrivyProvider → Smart Account → Paymaster |
| **Wallets** | Determinística + Privy Smart Account |
| **Arquivo** | `frontend/src/services/privy-*.ts` |
| **Status** | ✅ Integrado (substituiu Biconomy) |

### Polygon Blockchain
| Aspecto | Detalhe |
|---------|---------|
| **Amoy Testnet** | Chain ID 80002 |
| **Mainnet** | Chain ID 137 |
| **RPC Amoy** | https://rpc-amoy.polygon.technology |
| **RPC Mainnet** | https://polygon-rpc.com |
| **Bibliotecas** | ethers.js v6 (frontend) + web3.py (backend) |
| **Status** | ✅ Integrado |

### SendGrid (Email)
| Aspecto | Detalhe |
|---------|---------|
| **Variáveis** | SENDGRID_API_KEY, FROM_EMAIL |
| **Uso** | Notificações, recuperação de conta, confirmações |
| **Arquivo** | `backend/api/utils/email.py` |
| **Status** | ✅ Integrado |

### Redis (Rate Limiting)
| Aspecto | Detalhe |
|---------|---------|
| **Variável** | REDIS_URL |
| **Uso** | Rate limiting de requisições, cache |
| **Arquivo** | `backend/api/middleware/rate_limit.py` |
| **Status** | ✅ Integrado |

---

## 4. VARIÁVEIS DE AMBIENTE OBRIGATÓRIAS

### Backend (32 variáveis necessárias)

#### Críticas (deploy não funciona sem)
```
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET_KEY=sua-chave-secreta-jwt
RPC_URL=https://rpc-amoy.polygon.technology
IDENTITY_NFT_ADDRESS=0x...
PROOF_REGISTRY_ADDRESS=0x...
MINTER_PRIVATE_KEY=0x...
SUMSUB_APP_TOKEN=prd:...
SUMSUB_SECRET_KEY=...
```

#### Importantes (funcionalidades específicas)
```
SENDGRID_API_KEY=SG....
VAPID_PRIVATE_KEY=...
VAPID_PUBLIC_KEY=...
REDIS_URL=redis://localhost:6379
ADMIN_PRIVATE_KEY=0x...
```

#### Opcionais (com defaults)
```
FLASK_ENV=development
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:3000,https://blocktrust.com
SENTRY_DSN=...
```

### Frontend (20 variáveis necessárias)

#### Críticas
```
VITE_PRIVY_APP_ID=your-privy-app-id
VITE_CHAIN_ID=80002
VITE_POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
VITE_POLYGON_RPC_URL=https://polygon-rpc.com
VITE_IDENTITY_NFT_ADDRESS=0x...
VITE_PROOF_REGISTRY_ADDRESS=0x...
VITE_SUMSUB_APP_TOKEN=prd:...
```

#### Configuração de Wallet
```
VITE_WALLET_ITERATIONS=250000
VITE_WALLET_SALT=blocktrust-mainnet
```

#### Opcionais
```
VITE_API_BASE_URL=https://api.blocktrust.com
VITE_SECURITY_LEVEL=production
VITE_DEBUG_MODE=false
```

---

## 5. SMART CONTRACTS PRINCIPAIS

### IdentityNFT.sol (ERC721 + AccessControl)

| Função | Descrição |
|--------|-----------|
| `mintIdentity()` | Minta NFT soulbound com bioHash |
| `activeNFT(address)` | Retorna NFT ativo do usuário |
| `isActive(tokenId)` | Verifica se NFT está ativo |
| `revokeIdentity()` | Revoga NFT (cria novo com histórico) |

**Características**:
- Soulbound (não transferível)
- Histórico de revogações rastreável
- Vinculação biométrica imutável

### ProofRegistry.sol

| Função | Descrição |
|--------|-----------|
| `registerProof()` | Registra assinatura de documento |
| `verifyProof()` | Verifica se documento foi assinado |
| `revokeProof()` | Revoga assinatura |
| `storeDual()` | Registra assinatura dupla (PGP + blockchain) |

**Validações**:
- Requer NFT ativo do signatário
- Apenas proprietário pode revogar
- Histórico completo de assinaturas

### FailSafe.sol

- Contrato de recuperação de emergência
- Permite regeneração de wallet em caso de perda de acesso

---

## 6. ROTAS BACKEND PRINCIPAIS

### Autenticação (`/api/auth`)
```
POST   /register        - Criar conta
POST   /login           - Login com email/senha
POST   /logout          - Logout
GET    /me              - Dados do usuário autenticado
POST   /refresh-token   - Renovar JWT
```

### KYC (`/api/kyc`)
```
POST   /start-verification    - Iniciar verificação Sumsub
GET    /status/:applicant_id  - Status da verificação
POST   /complete              - Completar KYC e mintar NFT
GET    /history               - Histórico de verificações
```

### NFT (`/api/nft`)
```
GET    /active          - NFT ativo do usuário
POST   /recover         - Recuperar identidade
GET    /history         - Histórico de NFTs
POST   /cancel          - Cancelar NFT (admin)
```

### Assinaturas (`/api/signature`)
```
POST   /register        - Registrar assinatura
GET    /verify/:hash    - Verificar assinatura
POST   /revoke          - Revogar assinatura
POST   /dual-sign       - Assinatura dupla (PGP + blockchain)
```

### Documentos (`/api/document`)
```
POST   /upload          - Upload de documento
GET    /list            - Listar documentos do usuário
GET    /:id             - Detalhes do documento
DELETE /:id             - Deletar documento
```

### MFA (`/api/mfa`)
```
POST   /setup           - Gerar QR Code para MFA
POST   /verify-setup    - Verificar código TOTP
POST   /verify-login    - Verificar TOTP no login
GET    /backup-codes    - Gerar novos backup codes
POST   /disable         - Desabilitar MFA
```

### Admin (`/api/admin`)
```
GET    /users           - Listar usuários
POST   /users/:id/edit  - Editar usuário
POST   /users/:id/mfa-reset - Reset MFA
GET    /analytics       - Métricas do sistema
```

---

## 7. BANCO DE DADOS

### Tabelas Principais
1. **users**: Usuários do sistema
2. **identities**: NFTs de identidade (com histórico)
3. **document_signatures**: Assinaturas de documentos
4. **dual_sign_logs**: Log de assinaturas duplas
5. **events**: Eventos do sistema
6. **failsafe_events**: Eventos de recuperação
7. **listener_heartbeat**: Health check do listener blockchain
8. **metrics**: Métricas de performance

**Status**: ✅ 8 tabelas criadas e migradas

---

## 8. REQUISITOS PARA RODAR LOCALMENTE

### Pré-requisitos
- Node.js 18+
- Python 3.11+
- PostgreSQL 14+
- Redis (para rate limiting)

### Setup Backend
```bash
cd backend
pip install -r requirements.txt
python apply_migrations.py
export FLASK_ENV=development
python app.py  # Porta 10000
```

### Setup Frontend
```bash
cd frontend
npm install
npm run dev  # Porta 5173
```

### Setup Smart Contracts
```bash
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost
```

### Variáveis Mínimas para Dev
```
DATABASE_URL=postgresql://user:pass@localhost:5432/blocktrust
JWT_SECRET_KEY=dev-secret-key
VITE_PRIVY_APP_ID=test-app-id
SUMSUB_APP_TOKEN=test-token
SUMSUB_SECRET_KEY=test-secret
```

---

## 9. REQUISITOS PARA DEPLOY

### Render (Backend + Database)

**Serviços**:
1. **bts-blocktrust** (Web): Flask API + Gunicorn
2. **bts-blocktrust-listener** (Worker): Event listener blockchain
3. **bts-blocktrust-monitor** (Worker): System monitor

**Configuração**:
```yaml
buildCommand: bash build.sh
startCommand: cd backend && gunicorn app:app --bind 0.0.0.0:$PORT
```

### Vercel (Frontend)

**Configuração**:
- Build: `npm run build`
- Output: `dist/`
- Framework: Vite
- Node: 18+

### Pontos de Reconfiguração Obrigatórios

1. **Redes Blockchain**:
   - Mudar `VITE_CHAIN_ID` de 80002 (Amoy) para 137 (Mainnet)
   - Atualizar RPC URLs para Mainnet
   - Mudar `VITE_WALLET_SALT` para "blocktrust-mainnet"

2. **Segurança**:
   - Gerar novas chaves privadas
   - Gerar novo `JWT_SECRET_KEY`
   - Gerar novo `SECRET_KEY` Flask
   - Gerar `VAPID` keys para push notifications

3. **Integração Sumsub**:
   - Usar credenciais de produção (não sandbox)
   - Configurar webhook secret
   - Validar nível KYC

4. **Privy**:
   - Criar app de produção
   - Configurar gas sponsorship policies
   - Whitelisting de contratos

5. **Database**:
   - Habilitar SSL
   - Configurar backups automáticos
   - Implementar retenção de logs

6. **CORS e Domínios**:
   - Atualizar `CORS_ORIGINS`
   - Configurar HTTPS obrigatório
   - Atualizar URLs de callback

---

## 10. RISCOS E VULNERABILIDADES IDENTIFICADAS

### 🔴 CRÍTICOS

**1. Chaves Privadas em Variáveis de Ambiente**
- **Risco**: Exposição via logs, histórico shell, dumps de memória
- **Mitigação**: Usar vault (HashiCorp Vault, AWS Secrets Manager)
- **Status**: ⚠️ ABERTO

**2. Wallet Determinística em Memória**
- **Risco**: Pode ser dumpada de memória em caso de ataque
- **Mitigação**: Implementar memory encryption, session timeouts
- **Status**: ⚠️ ABERTO

**3. PBKDF2 com Iterações Configuráveis**
- **Risco**: Se `VITE_WALLET_ITERATIONS` for baixo, wallet fica fraca
- **Mitigação**: Validar mínimo 100.000 iterações em produção
- **Status**: ⚠️ ABERTO

### 🟠 ALTOS

**1. TODO: Chamar contrato ProofRegistry.storeDual** (pgp_routes.py:233)
- **Impacto**: Assinatura dupla não está sendo registrada no blockchain
- **Status**: ⚠️ ABERTO

**2. TODO: Verificar NFT ativo via IdentityNFT.isActive** (pgp_routes.py:387)
- **Impacto**: Validação incompleta de NFT ativo
- **Status**: ⚠️ ABERTO

**3. TODO: Chamar contrato IdentityNFT.cancelNFT** (nft.py:447)
- **Impacto**: Cancelamento de NFT não é persistido no blockchain
- **Status**: ⚠️ ABERTO

**4. MFA Não Protege Transações Blockchain**
- **Risco**: MFA protege login, mas não transações
- **Mitigação**: Implementar confirmação em 2 etapas para transações
- **Status**: ⚠️ ABERTO

**5. Rate Limiting Baseado em Redis**
- **Risco**: Se Redis cair, rate limiting falha
- **Mitigação**: Implementar fallback em memória
- **Status**: ⚠️ ABERTO

### 🟡 MÉDIOS

**1. Sumsub Webhook Secret Não Validado**
- **Risco**: Webhooks podem ser falsificados
- **Mitigação**: Validar assinatura do webhook
- **Status**: ⚠️ ABERTO

**2. Logs Contêm Dados Sensíveis**
- **Risco**: Endereços, hashes podem ser expostos
- **Mitigação**: Sanitizar logs, usar níveis apropriados
- **Status**: ⚠️ ABERTO

**3. IPFS Opcional Mas Não Documentado**
- **Risco**: Documentos podem ser perdidos
- **Mitigação**: Tornar IPFS obrigatório ou implementar fallback
- **Status**: ⚠️ ABERTO

**4. Listener Blockchain Pode Ficar Desatualizado**
- **Risco**: Eventos podem ser perdidos
- **Mitigação**: Implementar retry logic e health checks
- **Status**: ✅ IMPLEMENTADO (listener_heartbeat)

---

## 11. DEPENDÊNCIAS CRÍTICAS EXTERNAS

### Produção
- PostgreSQL 14+
- Redis (rate limiting)
- Polygon RPC (Alchemy, Infura, etc.)
- Sumsub API
- Privy API
- SendGrid API

### Desenvolvimento
- Hardhat (compilação/deploy contratos)
- Vite (build frontend)
- Flask (backend)
- Web3.py (interação blockchain)
- Ethers.js (frontend blockchain)

---

## 12. RECOMENDAÇÕES IMEDIATAS

### Curto Prazo (Antes de Produção)
1. ✅ Completar TODOs de integração blockchain
2. ✅ Implementar validação de webhook Sumsub
3. ✅ Adicionar confirmação 2FA para transações críticas
4. ✅ Implementar vault para chaves privadas
5. ✅ Adicionar testes de segurança (OWASP Top 10)

### Médio Prazo
1. Implementar IPFS obrigatório
2. Adicionar suporte para múltiplas blockchains
3. Implementar social recovery para wallets
4. Adicionar analytics de uso
5. Implementar backup automático de dados

### Longo Prazo
1. Migrar para arquitetura de microserviços
2. Implementar sharding de dados
3. Adicionar suporte para L2s (Arbitrum, Optimism)
4. Implementar DAO governance
5. Adicionar marketplace de documentos

---

## 13. RESUMO EXECUTIVO

**Blocktrust V2** é um sistema descentralizado completo para identidade self-custodial e assinatura de documentos. A arquitetura combina:

- **Inovação**: Wallets determinísticas geradas a partir de biometria (nunca armazenadas)
- **Segurança**: NFTs soulbound, PBKDF2 com 250.000 iterações, MFA TOTP
- **Escalabilidade**: Account Abstraction via Privy, transações gasless
- **Conformidade**: KYC via Sumsub, LGPD-ready

**Status**: ✅ Operacional em Amoy Testnet, pronto para produção com ajustes de segurança

**Próximos Passos**: Completar TODOs de blockchain, implementar vault para chaves, adicionar testes de segurança, migrar para Mainnet.

