# Arquitetura BTS Blocktrust

## Visão Geral

O BTS Blocktrust é uma aplicação web full-stack que implementa um sistema descentralizado para registro, assinatura e verificação de documentos utilizando blockchain Polygon.

## Componentes Principais

### Frontend (React + TypeScript)

O frontend é uma Single Page Application (SPA) construída com React 18 e TypeScript, utilizando Vite como bundler. A interface é responsiva e utiliza Tailwind CSS para estilização.

**Principais características:**
- Autenticação JWT com contexto React
- Cálculo de hash SHA-256 no navegador (client-side)
- Upload de arquivos com drag-and-drop
- Geração de QR codes e certificados PDF
- Roteamento com React Router

**Fluxo de dados:**
1. Usuário faz upload do documento
2. Hash SHA-256 é calculado localmente
3. Apenas o hash é enviado para o backend
4. Backend interage com Toolblox (blockchain)
5. Resultado é exibido ao usuário

### Backend (Flask + Python)

O backend é uma API REST construída com Flask, responsável por:
- Autenticação e autorização (JWT)
- Proxy para serviços blockchain (Toolblox)
- Integração com KYC (Sumsub)
- Envio de emails (SendGrid)
- Persistência de dados (PostgreSQL)

**Rotas principais:**
- `/api/auth/*` - Autenticação
- `/api/proxy/*` - Proxy para blockchain
- `/api/panic` - Alertas de segurança

### Banco de Dados (PostgreSQL)

Esquema relacional com 5 tabelas principais:
- `users` - Usuários do sistema
- `identities` - Identidades verificadas (NFTs)
- `signatures` - Assinaturas registradas
- `alerts` - Alertas de pânico
- `access_logs` - Logs de acesso

### Blockchain (Toolblox + Polygon)

Integração com smart contracts via Toolblox:
- **Identity NFT Workflow** - Mint de identidade após KYC
- **Signature Registry Workflow** - Registro de assinaturas
- **Verification Workflow** - Verificação de documentos

Inicialmente em **Polygon Amoy** (testnet), com migração planejada para **Mainnet**.

## Fluxo de Dados

```
Browser → Frontend (React)
    ↓
    Hash SHA-256 (local)
    ↓
Backend (Flask API)
    ↓
    ├─→ PostgreSQL (persistência)
    ├─→ Toolblox (blockchain)
    ├─→ Sumsub (KYC)
    └─→ SendGrid (emails)
```

## Segurança

1. **Privacidade:** Apenas o hash trafega, nunca o documento original
2. **Autenticação:** JWT com expiração de 7 dias
3. **Senhas:** Bcrypt com salt
4. **HTTPS:** Obrigatório em produção
5. **CORS:** Configurado para domínios específicos
6. **Variáveis sensíveis:** Apenas no backend (.env)

## Escalabilidade

- Frontend servido via CDN (Render)
- Backend com Gunicorn (múltiplos workers)
- PostgreSQL com connection pooling
- Cache de consultas blockchain (futuro)

## Conformidade LGPD

- Dados mínimos coletados
- Hash não é dado pessoal
- Logs com retenção limitada
- Direito ao esquecimento implementado

