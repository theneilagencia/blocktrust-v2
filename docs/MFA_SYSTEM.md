# Multi-Factor Authentication (MFA/2FA) - Blocktrust

## Visão Geral

O sistema MFA (Multi-Factor Authentication) do Blocktrust adiciona uma camada extra de segurança às contas dos usuários usando autenticação baseada em TOTP (Time-based One-Time Password), compatível com aplicativos como Google Authenticator, Authy e Microsoft Authenticator.

**⚠️ IMPORTANTE**: O MFA protege o **acesso à conta/aplicação**, não as transações blockchain. As operações na Polygon continuam sendo assinadas com a wallet determinística do usuário.

## Funcionalidades

### ✅ Implementado
- Setup completo de MFA com QR Code
- Verificação TOTP de 6 dígitos
- Códigos de backup para recuperação
- Login em duas etapas
- Desativação segura de MFA
- Regeneração de códigos de backup
- Interface amigável e intuitiva
- Compatibilidade com apps autenticadores
- Testes automatizados

### 🔐 Segurança
- Criptografia de secrets TOTP
- Hashing seguro de códigos de backup
- Validação rigorosa de tokens
- Rate limiting para tentativas
- Logs de auditoria
- Detecção de atividade suspeita

## Arquitetura

### Backend (Python/Flask)
```
api/
├── services/
│   └── mfa_service.py          # Lógica principal MFA
├── routes/
│   └── mfa_routes.py           # Endpoints REST
├── auth.py                     # Autenticação atualizada
└── models.py                   # Modelos com campos MFA
```

### Frontend (React/TypeScript)
```
src/
├── services/
│   └── mfa.service.ts          # Cliente API MFA
├── hooks/
│   └── useMFA.ts               # Hook React para MFA
├── components/
│   ├── MFASetup.tsx           # Setup completo
│   ├── LoginWithMFA.tsx       # Login com 2FA
│   └── SecuritySettings.tsx   # Configurações
└── tests/
    └── mfa-basic.test.ts      # Testes
```

### Banco de Dados
```sql
-- Campos adicionados à tabela users
ALTER TABLE users 
ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN mfa_secret TEXT,
ADD COLUMN backup_codes TEXT;
```

## Fluxo de Uso

### 1. Setup Inicial do MFA

```typescript
// 1. Gerar secret e QR Code
const setupData = await mfaApi.setupMFA();

// 2. Usuário escaneia QR Code no app
// 3. Verificar código TOTP
const verified = await mfaApi.verifySetup(
  setupData.secret, 
  userInputCode, 
  setupData.backupCodes
);

// 4. MFA habilitado com sucesso
```

### 2. Login com MFA

```typescript
// 1. Login com email/senha
const loginResult = await mfaApi.loginWithMFA(email, password);

if (loginResult.mfa_required) {
  // 2. Solicitar código MFA
  const finalResult = await mfaApi.loginWithMFA(
    email, 
    password, 
    mfaCode
  );
  // Login completo
}
```

### 3. Gerenciamento de Códigos de Backup

```typescript
// Regenerar códigos
const newCodes = await mfaApi.regenerateBackupCodes(totpCode);

// Download seguro
mfaApi.downloadBackupCodes(newCodes, userEmail);
```

## Endpoints API

### Setup e Configuração
- `POST /api/mfa/setup` - Gerar secret e QR code
- `POST /api/mfa/verify-setup` - Verificar e ativar MFA
- `POST /api/mfa/disable` - Desativar MFA
- `GET /api/mfa/status` - Status do MFA

### Verificação
- `POST /api/mfa/verify` - Verificar token TOTP/backup
- `POST /api/mfa/backup-codes/regenerate` - Gerar novos códigos

### Autenticação
- `POST /api/auth/login` - Login com suporte MFA

## Componentes React

### MFASetup
Componente completo para configuração inicial:

```tsx
<MFASetup
  userEmail="user@example.com"
  onComplete={() => navigate('/dashboard')}
  onCancel={() => setShowSetup(false)}
/>
```

**Funcionalidades**:
- 5 etapas guiadas (intro, QR, verify, backup, complete)
- QR Code dinâmico
- Entrada manual de secret
- Validação em tempo real
- Download/cópia de códigos de backup

### LoginWithMFA
Login aprimorado com suporte 2FA:

```tsx
<LoginWithMFA
  onLoginSuccess={(user) => setUser(user)}
  redirectTo="/dashboard"
/>
```

**Funcionalidades**:
- Fluxo de 2 etapas
- Detecção automática de MFA
- Suporte a códigos de backup
- Interface animada e responsiva

### SecuritySettings
Página completa de configurações de segurança:

```tsx
<SecuritySettings
  userEmail={user.email}
  walletAddress={user.walletAddress}
  smartAccountAddress={user.smartAccountAddress}
/>
```

**Funcionalidades**:
- Status visual do MFA
- Setup/desativação de MFA
- Regeneração de códigos
- Informações blockchain
- Alertas de segurança

## Teste e Validação

### Testes Automatizados
```bash
# Executar testes MFA
cd frontend && npx vitest run tests/mfa-basic.test.ts

# Cobertura
npm run test:coverage
```

### Teste Manual
1. **Setup MFA**:
   - Registrar nova conta
   - Acessar configurações de segurança
   - Ativar 2FA com Google Authenticator
   - Verificar códigos de backup

2. **Login com MFA**:
   - Fazer logout
   - Login com email/senha
   - Inserir código do app
   - Verificar acesso completo

3. **Códigos de Backup**:
   - Tentar login com código de backup
   - Verificar que código é invalidado após uso
   - Regenerar novos códigos

4. **Desativação**:
   - Desativar MFA com senha + código
   - Verificar que login volta ao normal

## Segurança e Boas Práticas

### Implementado
- ✅ Secrets TOTP criptografados no banco
- ✅ Códigos de backup com hash bcrypt
- ✅ Validação rigorosa de entrada
- ✅ Window de verificação para clock drift
- ✅ Rate limiting em tentativas
- ✅ Logs de auditoria
- ✅ Detecção de atividade suspeita

### Recomendações
- Use HTTPS em produção
- Configure rate limiting no nginx/proxy
- Monitore logs de tentativas falhadas
- Backup regular do banco de dados
- Rotação periódica de chaves de criptografia

## Configuração de Produção

### Variáveis de Ambiente
```bash
# Backend
MFA_ENCRYPTION_KEY=your-32-character-encryption-key-here
MFA_APP_NAME=Blocktrust

# Segurança adicional
RATE_LIMIT_MFA_ATTEMPTS=5
MFA_TOKEN_WINDOW=2
```

### Dependências
```bash
# Backend
pip install pyotp qrcode[pil] Pillow

# Frontend  
npm install qrcode.react react-hook-form @hookform/resolvers zod framer-motion react-hot-toast
```

## Monitoramento

### Logs Importantes
- Setup de MFA por usuário
- Tentativas de login com MFA
- Uso de códigos de backup
- Desativação de MFA
- Tentativas suspeitas

### Métricas
- Taxa de adoção do MFA
- Tentativas de login falhadas
- Uso de códigos de backup
- Tempo médio de setup

## Troubleshooting

### Problemas Comuns
1. **QR Code não funciona**
   - Verificar se secret está sendo gerado
   - Testar entrada manual
   - Verificar compatibilidade do app

2. **Códigos sempre inválidos**
   - Sincronização de hora (servidor/dispositivo)
   - Window de verificação muito pequeno
   - App autenticador incorreto

3. **Não consegue fazer login**
   - Usar códigos de backup
   - Verificar se MFA está realmente ativado
   - Logs de tentativas

### Recuperação
- Códigos de backup permitem acesso
- Admin pode desativar MFA via database
- Logs ajudam a diagnosticar problemas

## Roadmap Futuro

### Melhorias Planejadas
- [ ] Push notifications para tentativas de login
- [ ] Dispositivos confiáveis (remember device)
- [ ] Múltiplos métodos 2FA (SMS, email)
- [ ] Dashboard de segurança avançado
- [ ] Integração com hardware keys (WebAuthn)

### Integração Blockchain
- [ ] MFA para operações sensíveis na Polygon
- [ ] Assinatura de transações com 2FA
- [ ] Recovery de wallet com MFA

## Conclusão

O sistema MFA do Blocktrust oferece uma camada robusta de segurança para contas de usuário, mantendo a simplicidade de uso e compatibilidade com ferramentas padrão da indústria. A implementação garante que as operações blockchain continuem descentralizadas enquanto protege o acesso à aplicação.

Para suporte técnico ou dúvidas sobre implementação, consulte a documentação da API ou entre em contato com a equipe de desenvolvimento.
