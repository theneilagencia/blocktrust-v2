# Documentação da API

## Base URL
```
Production: https://bts-blocktrust.onrender.com/api
Development: http://localhost:5000/api
```

## Autenticação

A API utiliza JWT (JSON Web Tokens) para autenticação. Inclua o token no header:

```
Authorization: Bearer <token>
```

---

## Endpoints

### 🔐 Autenticação

#### POST /auth/register
Cria uma nova conta de usuário.

**Request:**
```json
{
  "email": "usuario@example.com",
  "password": "senha123"
}
```

**Response (201):**
```json
{
  "message": "Usuário cadastrado com sucesso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "usuario@example.com",
    "role": "user"
  }
}
```

---

#### POST /auth/login
Autentica um usuário existente.

**Request:**
```json
{
  "email": "usuario@example.com",
  "password": "senha123"
}
```

**Response (200):**
```json
{
  "message": "Login realizado com sucesso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "usuario@example.com",
    "role": "user"
  }
}
```

---

#### GET /auth/me
Retorna informações do usuário autenticado.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "usuario@example.com",
    "role": "user"
  }
}
```

---

### 🔗 Proxy Blockchain

#### POST /proxy/identity
Cria uma identidade NFT após KYC (Sumsub).

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "proof_cid": "QmXxxx..."
}
```

**Response (200):**
```json
{
  "token_id": "123",
  "tx_hash": "0xabc123...",
  "status": "success"
}
```

---

#### POST /proxy/signature
Registra a assinatura de um documento na blockchain.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "hash": "a1b2c3d4e5f6789...",
  "signer": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

**Response (200):**
```json
{
  "tx_hash": "0xdef456...",
  "block_number": 12345678,
  "status": "confirmed"
}
```

---

#### POST /proxy/verify
Verifica se um documento está registrado na blockchain.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "hash": "a1b2c3d4e5f6789..."
}
```

**Response (200):**
```json
{
  "verified": true,
  "tx_hash": "0xdef456...",
  "signer": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### 🚨 Alertas

#### POST /panic
Registra um alerta de pânico e envia email.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "hash": "a1b2c3d4e5f6789...",
  "note": "Documento suspeito de fraude"
}
```

**Response (200):**
```json
{
  "message": "Alerta de pânico registrado e email enviado"
}
```

---

## Códigos de Status

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 201 | Criado |
| 400 | Requisição inválida |
| 401 | Não autorizado |
| 403 | Acesso negado |
| 404 | Não encontrado |
| 409 | Conflito (ex: email já cadastrado) |
| 500 | Erro interno do servidor |

---

## Erros

Formato padrão de erro:

```json
{
  "error": "Descrição do erro"
}
```

---

## Rate Limiting

Atualmente não há rate limiting implementado. Planejado para versão futura.

---

## Versionamento

Versão atual: **v1**

Futuras versões serão acessadas via `/api/v2/...`

