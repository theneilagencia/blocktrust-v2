# Blocktrust - Rodando no Manus

## Status do Sistema

✅ **Backend Flask**: Rodando na porta 10000  
✅ **Frontend React**: Rodando na porta 5173  
✅ **PostgreSQL**: Configurado e rodando  
✅ **Banco de dados**: Migrations aplicadas com sucesso

## URLs de Acesso

### Frontend (Interface do Usuário)
**URL Pública**: https://5173-iys5mniiz7jb4wg6aawdx-d6669e93.manusvm.computer

### Backend API
**URL Pública**: https://10000-iys5mniiz7jb4wg6aawdx-d6669e93.manusvm.computer

**Health Check**: https://10000-iys5mniiz7jb4wg6aawdx-d6669e93.manusvm.computer/api/health

## Configuração do Ambiente

### Banco de Dados PostgreSQL
- **Database**: blocktrust
- **User**: blocktrust_user
- **Password**: blocktrust_pass
- **Host**: localhost
- **Port**: 5432

### Tabelas Criadas
1. users
2. document_signatures
3. dual_sign_logs
4. events
5. failsafe_events
6. listener_heartbeat
7. metrics
8. nft_cancellations

## Arquivos de Configuração

### Backend (.env)
Localização: `/home/ubuntu/blocktrust/backend/.env`

Principais configurações:
- DATABASE_URL configurado
- Flask em modo desenvolvimento
- RPC_URL apontando para Polygon Amoy Testnet
- Contratos ainda não deployados (endereços zerados)

### Frontend (.env)
Localização: `/home/ubuntu/blocktrust/frontend/.env`

Principais configurações:
- VITE_API_URL=http://localhost:5000
- VITE_RPC_URL=https://rpc-amoy.polygon.technology
- VITE_CHAIN_ID=80002 (Polygon Amoy Testnet)

**Nota**: O frontend está configurado para aceitar conexões do domínio Manus através do `vite.config.ts`

## Estrutura do Projeto

```
/home/ubuntu/blocktrust/
├── backend/              # API Flask
│   ├── api/             # Rotas e lógica da API
│   ├── migrations/      # Migrations do banco de dados
│   ├── logs/            # Logs da aplicação
│   ├── uploads/         # Uploads de arquivos
│   └── app.py          # Aplicação principal
├── frontend/            # Interface React
│   ├── src/            # Código fonte React
│   └── public/         # Arquivos estáticos
├── contracts/          # Smart Contracts Solidity
├── scripts/            # Scripts utilitários
└── docs/               # Documentação

```

## Comandos Úteis

### Reiniciar Backend
```bash
cd /home/ubuntu/blocktrust
./start_backend.sh
```

### Reiniciar Frontend
```bash
cd /home/ubuntu/blocktrust/frontend
npm run dev
```

### Verificar Logs do Backend
```bash
tail -f /home/ubuntu/blocktrust/backend/logs/blocktrust.log
```

### Acessar PostgreSQL
```bash
sudo -u postgres psql -d blocktrust
```

## Funcionalidades Disponíveis

### Backend API Endpoints
- `/api/health` - Health check
- `/api/auth/*` - Autenticação e registro
- `/api/wallet/*` - Gerenciamento de carteiras
- `/api/nft/*` - Operações com NFTs
- `/api/signature/*` - Assinatura de documentos
- `/api/document/*` - Gerenciamento de documentos
- `/api/explorer/*` - Explorador blockchain
- `/api/mfa/*` - Multi-factor authentication
- `/api/admin/*` - Administração

### Frontend Features
- Sistema de identidade self-custodial
- Autenticação biométrica (Sumsub SDK)
- Geração determinística de carteiras
- Soulbound Identity NFTs
- Assinatura descentralizada de documentos
- Sistema de recuperação de emergência
- Account Abstraction (ERC-4337)
- Multi-Factor Authentication (2FA/TOTP)

## Observações Importantes

### ⚠️ Configurações Pendentes

1. **Smart Contracts**: Os contratos ainda não foram deployados na rede Polygon Amoy. Os endereços nos arquivos .env estão zerados.

2. **Sumsub KYC**: As credenciais do Sumsub não foram configuradas. Para usar autenticação biométrica, é necessário:
   - Criar conta no Sumsub
   - Obter SUMSUB_APP_TOKEN e SUMSUB_SECRET_KEY
   - Configurar nos arquivos .env

3. **Biconomy (Gasless Transactions)**: Para habilitar transações sem gas:
   - Criar conta no Biconomy
   - Obter API keys
   - Configurar VITE_BICONOMY_API_KEY e VITE_BICONOMY_PAYMASTER_API_KEY

4. **RPC Polygon**: O RPC público pode ter limitações. Para produção, recomenda-se usar Alchemy ou Infura.

### ✅ Funcionando

- Backend Flask API
- Frontend React com Vite
- Banco de dados PostgreSQL
- Sistema de rotas e autenticação básica
- Estrutura completa do projeto

## Próximos Passos

Para ter o sistema completamente funcional:

1. **Deploy dos Smart Contracts**:
   ```bash
   cd /home/ubuntu/blocktrust
   npm run deploy:testnet
   ```

2. **Configurar Sumsub** (opcional, para biometria):
   - Adicionar credenciais nos arquivos .env

3. **Configurar Biconomy** (opcional, para gasless):
   - Adicionar API keys nos arquivos .env

4. **Testar Funcionalidades**:
   - Acessar o frontend
   - Criar conta
   - Testar geração de carteira

## Suporte

Para mais informações, consulte:
- README.md principal
- Documentação em `/docs/`
- Código fonte em `/src/`
