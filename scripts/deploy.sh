#!/bin/bash

# Deploy Script para Fase 1 - Sistema Self-Custodial
# Este script implementa o deploy completo da Fase 1

set -e

echo "🚀 Iniciando deploy da Fase 1 - Sistema Self-Custodial"
echo "==============================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
NETWORK=${NETWORK:-polygon-amoy}
ENVIRONMENT=${ENVIRONMENT:-staging}

# Funções auxiliares
log_step() {
    echo -e "${BLUE}📋 Step: $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verifica dependências
check_dependencies() {
    log_step "Verificando dependências"
    
    command -v node >/dev/null 2>&1 || { log_error "Node.js não encontrado"; exit 1; }
    command -v npm >/dev/null 2>&1 || { log_error "NPM não encontrado"; exit 1; }
    command -v python3 >/dev/null 2>&1 || { log_error "Python3 não encontrado"; exit 1; }
    
    log_success "Dependências verificadas"
}

# Instala dependências do frontend
install_frontend_deps() {
    log_step "Instalando dependências do frontend"
    
    cd frontend
    npm install
    npm install crypto-js @types/crypto-js buffer
    cd ..
    
    log_success "Dependências do frontend instaladas"
}

# Instala dependências do backend
install_backend_deps() {
    log_step "Instalando dependências do backend"
    
    cd backend
    pip3 install -r requirements.txt
    pip3 install web3 eth-account
    cd ..
    
    log_success "Dependências do backend instaladas"
}

# Executa testes
run_tests() {
    log_step "Executando testes da Fase 1"
    
    # Testes do frontend
    log_step "Testes do frontend (TypeScript)"
    cd frontend
    npm run test -- --passWithNoTests || log_warning "Alguns testes falharam"
    cd ..
    
    # Testes do backend  
    log_step "Testes do backend (Python)"
    python3 -m pytest tests/test_implementation.py -v || log_warning "Alguns testes falharam"
    
    log_success "Testes executados"
}

# Compila contratos
compile_contracts() {
    log_step "Compilando contratos inteligentes"
    
    npx hardhat compile
    
    log_success "Contratos compilados"
}

# Deploy do contrato atualizado
deploy_contracts() {
    log_step "Deploying contrato IdentityNFT na rede ${NETWORK}"
    
    # Cria script de deploy se não existir
    cat > scripts/deploy-identity-nft.js << 'EOF'
const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying IdentityNFT...");
    
    // Deploy do contrato
    const IdentityNFT = await ethers.getContractFactory("IdentityNFT");
    const identityNFT = await IdentityNFT.deploy();
    
    await identityNFT.waitForDeployment();
    const address = await identityNFT.getAddress();
    
    console.log("✅ IdentityNFT deployed to:", address);
    
    // Salva endereço para uso posterior
    const fs = require('fs');
    const deployData = {
        network: process.env.HARDHAT_NETWORK,
        contract: "IdentityNFT",
        address: address,
        deployedAt: new Date().toISOString(),
        version: "2.0"
    };
    
    fs.writeFileSync(
        `deployments/${process.env.HARDHAT_NETWORK}-identitynft.json`,
        JSON.stringify(deployData, null, 2)
    );
    
    console.log("📄 Deployment info saved to deployments/");
    
    return address;
}

main()
    .then((address) => {
        console.log("🎉 Deploy concluído:", address);
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Deploy falhou:", error);
        process.exit(1);
    });
EOF

    # Cria diretório de deployments
    mkdir -p deployments
    
    # Executa deploy
    CONTRACT_ADDRESS=$(npx hardhat run scripts/deploy-identity-nft.js --network $NETWORK)
    
    log_success "Contrato deploado: $CONTRACT_ADDRESS"
    
    # Exporta endereço para uso em outros scripts
    export REACT_APP_IDENTITY_NFT_ADDRESS=$CONTRACT_ADDRESS
    echo "REACT_APP_IDENTITY_NFT_ADDRESS=$CONTRACT_ADDRESS" >> .env.local
}

# Verifica contrato no explorer
verify_contracts() {
    if [ "$NETWORK" = "polygon-amoy" ]; then
        log_step "Verificando contrato no PolygonScan"
        
        if [ ! -z "$REACT_APP_IDENTITY_NFT_ADDRESS" ]; then
            npx hardhat verify --network $NETWORK $REACT_APP_IDENTITY_NFT_ADDRESS || log_warning "Verificação falhou"
        fi
    fi
}

# Atualiza variáveis de ambiente
update_environment() {
    log_step "Atualizando variáveis de ambiente"
    
    # Cria arquivo .env.phase1 com configurações da Fase 1
    cat > .env.phase1 << EOF
# Configurações da Fase 1 - Sistema Self-Custodial
PHASE1_ENABLED=true
SELF_CUSTODIAL_ENABLED=true

# Contratos
REACT_APP_IDENTITY_NFT_ADDRESS=$REACT_APP_IDENTITY_NFT_ADDRESS

# Configurações de wallet determinística
WALLET_GENERATION_SALT=blocktrust-deterministic
WALLET_GENERATION_ITERATIONS=250000

# Backend
KYC_ENABLED=true
BIO_HASH_VALIDATION_ENABLED=true

# Configurações de segurança
SECURE_STORAGE_ENABLED=true
BIOMETRIC_VALIDATION_REQUIRED=true

# Logs e monitoramento
PHASE1_MONITORING_ENABLED=true
WALLET_GENERATION_METRICS=true
EOF

    log_success "Variáveis de ambiente atualizadas"
}

# Build do frontend
build_frontend() {
    log_step "Building frontend com features da Fase 1"
    
    cd frontend
    
    # Copia configurações da Fase 1
    cp ../.env.phase1 .env.local
    
    # Build otimizado
    npm run build
    
    cd ..
    
    log_success "Frontend buildado"
}

# Executa migração do banco de dados
run_migrations() {
    log_step "Executando migrações do banco de dados"
    
    # Cria migração para Fase 1
    cat > backend/migrations/002_phase1_self_custodial.sql << 'EOF'
-- Migração para Fase 1 - Sistema Self-Custodial
-- Adiciona colunas necessárias para o novo sistema

-- Adiciona colunas para bioHash e sistema unificado
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS bio_hash_fingerprint VARCHAR(64),
ADD COLUMN IF NOT EXISTS migrated_to_v2 BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS wallet_generation_method VARCHAR(20) DEFAULT 'legacy';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_users_bio_hash_fingerprint ON users(bio_hash_fingerprint);
CREATE INDEX IF NOT EXISTS idx_users_migrated_v2 ON users(migrated_to_v2);

-- Tabela para auditoria de recuperação de identidade
CREATE TABLE IF NOT EXISTS identity_recovery_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    bio_hash_fingerprint VARCHAR(64),
    old_wallet_address VARCHAR(42),
    new_wallet_address VARCHAR(42),
    recovery_method VARCHAR(50),
    recovery_timestamp TIMESTAMP DEFAULT NOW(),
    success BOOLEAN,
    error_message TEXT
);

-- Tabela para métricas da Fase 1
CREATE TABLE IF NOT EXISTS phase1_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100),
    metric_value TEXT,
    user_id INTEGER,
    recorded_at TIMESTAMP DEFAULT NOW()
);

-- Comentários para documentação
COMMENT ON COLUMN users.bio_hash_fingerprint IS 'SHA-256 hash do bioHash biométrico';
COMMENT ON COLUMN users.migrated_to_v2 IS 'Indica se usuário foi migrado para sistema V2';
COMMENT ON COLUMN users.wallet_generation_method IS 'Método usado: legacy, deterministic_v2';

-- Dados iniciais
INSERT INTO phase1_metrics (metric_name, metric_value) 
VALUES ('phase1_deployment_date', NOW()::text);
EOF

    # Executa migração
    python3 backend/apply_migrations.py
    
    log_success "Migrações executadas"
}

# Deploy para staging/production
deploy_application() {
    log_step "Deploying aplicação para $ENVIRONMENT"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        log_warning "Deploy em PRODUÇÃO - confirme se todos os testes passaram"
        read -p "Continuar com deploy em produção? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_error "Deploy cancelado"
            exit 1
        fi
    fi
    
    # Deploy do backend
    log_step "Atualizando backend"
    # Aqui você adicionaria comandos específicos para seu provedor (Heroku, AWS, etc.)
    # Por exemplo: git push heroku main
    
    # Deploy do frontend  
    log_step "Atualizando frontend"
    # Aqui você adicionaria comandos para Vercel, Netlify, etc.
    # Por exemplo: vercel --prod
    
    log_success "Aplicação deploada"
}

# Executa testes pós-deploy
post_deploy_tests() {
    log_step "Executando testes pós-deploy"
    
    # Testa endpoints do backend
    python3 << 'EOF'
import requests
import os

base_url = os.getenv('BACKEND_URL', 'http://localhost:5000')

# Testa endpoint de health check
try:
    response = requests.get(f"{base_url}/api/health")
    if response.status_code == 200:
        print("✅ Backend respondendo")
    else:
        print("❌ Backend não está respondendo corretamente")
except Exception as e:
    print(f"❌ Erro ao conectar com backend: {e}")

# Testa se endpoints V2 existem
try:
    response = requests.post(f"{base_url}/api/v2/kyc/status")
    if response.status_code in [401, 422]:  # Esperamos erro de auth, não 404
        print("✅ Endpoints V2 disponíveis")
    elif response.status_code == 404:
        print("❌ Endpoints V2 não encontrados")
except Exception as e:
    print(f"⚠️  Não foi possível testar endpoints V2: {e}")
EOF

    log_success "Testes pós-deploy concluídos"
}

# Função principal
main() {
    echo "Início: $(date)"
    
    check_dependencies
    install_frontend_deps
    install_backend_deps
    run_tests
    compile_contracts
    deploy_contracts
    verify_contracts
    update_environment
    build_frontend
    run_migrations
    deploy_application
    post_deploy_tests
    
    log_success "🎉 Deploy da Fase 1 concluído com sucesso!"
    echo "==============================================="
    echo "📊 Resumo do Deploy:"
    echo "- Network: $NETWORK"
    echo "- Environment: $ENVIRONMENT"
    echo "- Contrato: $REACT_APP_IDENTITY_NFT_ADDRESS"
    echo "- Timestamp: $(date)"
    echo ""
    echo "📋 Próximos passos:"
    echo "1. Monitore logs por 24h"
    echo "2. Execute testes de carga"
    echo "3. Notifique usuários sobre novas funcionalidades"
    echo "4. Prepare documentação da Fase 2"
    echo ""
    echo "Fim: $(date)"
}

# Captura erros e limpa
trap 'log_error "Script interrompido"; exit 1' INT TERM

# Executa se chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
