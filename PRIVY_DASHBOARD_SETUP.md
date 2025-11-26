# Guia de Configuração do Privy Dashboard

Este documento contém instruções para configurar manualmente as opções no dashboard da Privy que não puderam ser configuradas automaticamente.

## 📋 Informações do App

- **App ID**: `clzx3q2xg03a3jxwg0ys0lqrp`
- **App Name**: Blocktrust
- **Dashboard URL**: https://dashboard.privy.io/apps/clzx3q2xg03a3jxwg0ys0lqrp

## ⚙️ Configurações Necessárias

### 1. Smart Wallets

**Caminho**: Dashboard → Wallet infrastructure → Smart wallets

**Configurações**:
- ✅ **Enable Smart Wallets**: ON
- **Implementation**: Safe (recomendado)
- **Supported Chains**: 
  - Polygon Mainnet (Chain ID: 137)
  - Polygon Amoy Testnet (Chain ID: 80002)

**Por quê?**
Smart Wallets permitem transações gasless e melhor UX para usuários.

---

### 2. Gas Sponsorship

**Caminho**: Dashboard → Wallet infrastructure → Gas sponsorship

#### Para Polygon Amoy Testnet (Desenvolvimento)

**Configurações**:
- ✅ **Enable Gas Sponsorship**: ON
- **Network**: Polygon Amoy (80002)
- **Sponsorship Limits**:
  - Max gas per transaction: `0.01 MATIC`
  - Max transactions per user per day: `100`
  - Max gas per user per day: `1 MATIC`

**Contratos Patrocinados** (adicionar quando disponíveis):
- Identity NFT Contract: `[ENDEREÇO_DO_CONTRATO]`
- Proof Registry Contract: `[ENDEREÇO_DO_CONTRATO]`

#### Para Polygon Mainnet (Produção)

**Configurações**:
- ✅ **Enable Gas Sponsorship**: ON
- **Network**: Polygon Mainnet (137)
- **Sponsorship Limits**:
  - Max gas per transaction: `0.005 MATIC`
  - Max transactions per user per day: `50`
  - Max gas per user per day: `0.5 MATIC`

**Contratos Patrocinados**:
- Identity NFT Contract: `[ENDEREÇO_DO_CONTRATO_MAINNET]`
- Proof Registry Contract: `[ENDEREÇO_DO_CONTRATO_MAINNET]`

**Por quê?**
Gas sponsorship permite que usuários façam transações sem precisar ter MATIC na carteira.

---

### 3. UI Components (Whitelabel)

**Caminho**: Dashboard → Configuration → UI components

#### Appearance

**Logo**:
- Upload do logo BTS/Blocktrust
- Formato: PNG ou SVG
- Tamanho recomendado: 200x50px

**Colors**:
- **Accent Color**: `#1B5AB4` (Blue Highlight do BTS Design System)
- **Background**: `#FFFFFF`
- **Text Primary**: `#1A1A1A` (Neutral 900)
- **Text Secondary**: `#666666` (Neutral 600)

#### Text Content

**Landing Header**: `Bem-vindo ao Blocktrust`

**Login Message**: `Conecte sua identidade digital verificada`

**Connect Wallet Button**: `Conectar Identidade`

**Por quê?**
Mantém a identidade visual do BTS Design System e melhora a experiência do usuário.

---

### 4. Authentication Methods

**Caminho**: Dashboard → User management → Authentication

**Login Methods Habilitados**:
- ✅ **Email**: ON (principal método)
- ❌ **Social Logins**: OFF (não necessário inicialmente)
- ❌ **Phone**: OFF
- ❌ **Wallet Connectors**: OFF (usamos wallet determinística)

**Por quê?**
Email é suficiente para identificação inicial, antes da verificação biométrica.

---

### 5. Embedded Wallets

**Caminho**: Dashboard → Wallet infrastructure → Wallets

**Configurações**:
- ❌ **Create on Login**: OFF
- ❌ **Show Wallet UIs**: OFF

**Por quê?**
Não usamos embedded wallets da Privy - usamos wallet determinística gerada a partir do bioHash.

---

### 6. Webhooks (Opcional)

**Caminho**: Dashboard → Configuration → Webhooks

**Eventos Recomendados**:
- `user.created` - Quando usuário é criado
- `user.linked_account` - Quando wallet é conectada
- `wallet.created` - Quando smart wallet é criada

**Webhook URL**: `https://api.blocktrust.com/webhooks/privy`

**Por quê?**
Permite sincronizar eventos da Privy com o backend do Blocktrust.

---

## 🔐 Segurança

### API Keys

**Caminho**: Dashboard → App settings → API Keys

- **App ID**: Já configurado no `.env` (`VITE_PRIVY_APP_ID`)
- **App Secret**: **NÃO** adicionar no frontend (apenas backend se necessário)

### Allowed Domains

**Caminho**: Dashboard → App settings → Allowed domains

**Adicionar**:
- `http://localhost:5173` (desenvolvimento)
- `http://localhost:3000` (desenvolvimento alternativo)
- `https://blocktrust.com` (produção)
- `https://app.blocktrust.com` (produção)

**Por quê?**
Previne uso não autorizado do App ID em outros domínios.

---

## 📊 Monitoramento

### Analytics

**Caminho**: Dashboard → Home

Monitore:
- **Monthly Active Users (MAUs)**: Limite de 500 no plano Free
- **Transactions**: Volume de transações gasless
- **Gas Sponsored**: Custo total de gas patrocinado

**Alerta**: Quando atingir 400 MAUs (80% do limite), considere upgrade para plano Core.

---

## 🚀 Próximos Passos

Após configurar o dashboard:

1. ✅ Testar autenticação no frontend
2. ✅ Verificar criação de Smart Wallets
3. ✅ Testar transação gasless
4. ✅ Validar whitelabel/aparência
5. ✅ Configurar webhooks (se necessário)

---

## 📞 Suporte

Se tiver dúvidas ou problemas:

- **Documentação**: https://docs.privy.io
- **Discord**: https://discord.gg/privy
- **Email**: support@privy.io

---

## ✅ Checklist de Configuração

- [ ] Smart Wallets habilitadas
- [ ] Gas Sponsorship configurado (Amoy)
- [ ] Gas Sponsorship configurado (Mainnet)
- [ ] Contratos adicionados à lista de patrocínio
- [ ] Logo BTS/Blocktrust carregado
- [ ] Cores do BTS Design System aplicadas
- [ ] Textos customizados
- [ ] Email login habilitado
- [ ] Embedded Wallets desabilitadas
- [ ] Allowed domains configurados
- [ ] Webhooks configurados (opcional)

---

**Última atualização**: 2025-11-20
