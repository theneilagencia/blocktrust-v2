# Migração Amoy → Mainnet

## Visão Geral

Este documento descreve o processo de migração dos workflows Toolblox da testnet **Polygon Amoy** para a **Mainnet Polygon**.

## Pré-requisitos

1. ✅ Workflows testados e validados em Amoy
2. ✅ Carteira com MATIC suficiente na Mainnet
3. ✅ Acesso ao painel Toolblox
4. ✅ Backup completo do banco de dados
5. ✅ Testes E2E passando

## Passo a Passo

### 1. Publicar Workflows na Mainnet

Acesse o painel Toolblox e publique cada workflow na Mainnet:

**a) Identity NFT Workflow**
- Abra o workflow `56d9f5cd`
- Clique em "Deploy to Mainnet"
- Confirme a transação na carteira
- Anote a nova Run URL

**b) Signature Registry Workflow**
- Abra o workflow `996dadb0`
- Clique em "Deploy to Mainnet"
- Confirme a transação na carteira
- Anote a nova Run URL

**c) Document Verification Workflow**
- Abra o workflow `0fdc5e3a dde7beba`
- Clique em "Deploy to Mainnet"
- Confirme a transação na carteira
- Anote a nova Run URL

### 2. Atualizar Variáveis de Ambiente

No painel do Render, atualize as seguintes variáveis:

```bash
TOOLBLOX_MINT_IDENTITY_URL=<nova-url-mainnet-identity>
TOOLBLOX_REGISTER_SIGNATURE_URL=<nova-url-mainnet-signature>
TOOLBLOX_VERIFY_URL=<nova-url-mainnet-verify>
TOOLBLOX_NETWORK=mainnet
```

### 3. Redeploy da Aplicação

```bash
# Via Render Dashboard
1. Acesse o serviço bts-blocktrust
2. Clique em "Manual Deploy"
3. Selecione branch "master"
4. Aguarde o deploy

# Ou via GitHub
git commit --allow-empty -m "Deploy: Migração para Mainnet"
git push origin master
```

### 4. Testes Pós-Migração

Execute os seguintes testes:

**a) Mint de Identidade**
```bash
curl -X POST https://bts-blocktrust.onrender.com/api/proxy/identity \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "0x...",
    "proof_cid": "QmXxxx..."
  }'
```

**b) Registro de Assinatura**
```bash
curl -X POST https://bts-blocktrust.onrender.com/api/proxy/signature \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "hash": "a1b2c3...",
    "signer": "0x..."
  }'
```

**c) Verificação**
```bash
curl -X POST https://bts-blocktrust.onrender.com/api/proxy/verify \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "hash": "a1b2c3..."
  }'
```

### 5. Validação no PolygonScan

Verifique as transações no PolygonScan:

```
https://polygonscan.com/tx/<tx_hash>
```

Confirme:
- ✅ Status: Success
- ✅ Gas usado
- ✅ Bloco confirmado
- ✅ Smart contract correto

### 6. Monitoramento

Monitore por 24-48 horas:
- Logs de erro no Render
- Tempo de resposta das transações
- Custos de gas
- Alertas de pânico

## Rollback

Se necessário, reverta para Amoy:

```bash
# No Render, atualize:
TOOLBLOX_MINT_IDENTITY_URL=<url-amoy-identity>
TOOLBLOX_REGISTER_SIGNATURE_URL=<url-amoy-signature>
TOOLBLOX_VERIFY_URL=<url-amoy-verify>
TOOLBLOX_NETWORK=amoy

# Redeploy
```

## Custos Estimados

| Operação | Gas Estimado | Custo (MATIC) |
|----------|--------------|---------------|
| Mint Identity | ~100,000 | ~0.002 |
| Register Signature | ~80,000 | ~0.0016 |
| Verify | ~50,000 | ~0.001 |

**Nota:** Custos variam com o preço do gas.

## Checklist Final

- [ ] Workflows publicados na Mainnet
- [ ] Variáveis de ambiente atualizadas
- [ ] Redeploy concluído
- [ ] Testes manuais executados
- [ ] Transações verificadas no PolygonScan
- [ ] Monitoramento ativo
- [ ] Equipe notificada
- [ ] Documentação atualizada

## Suporte

Em caso de problemas:
1. Verifique logs no Render
2. Consulte documentação Toolblox
3. Entre em contato: help@btsglobalcorp.com

