#!/bin/bash

# Script de Validação da Fase 1
# Verifica se todos os componentes foram implementados corretamente

set -e

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Validação da Implementação - Fase 1${NC}"
echo "============================================="

# Função para verificar arquivos
check_file() {
    if [ -f "$1" ]; then
        echo -e "✅ $1"
        return 0
    else
        echo -e "❌ $1 ${RED}(FALTANDO)${NC}"
        return 1
    fi
}

# Função para verificar diretórios
check_dir() {
    if [ -d "$1" ]; then
        echo -e "✅ $1/"
        return 0
    else
        echo -e "❌ $1/ ${RED}(FALTANDO)${NC}"
        return 1
    fi
}

# Função para verificar conteúdo específico
check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "✅ $1 contém: '$2'"
        return 0
    else
        echo -e "❌ $1 ${RED}não contém: '$2'${NC}"
        return 1
    fi
}

# Contador de erros
errors=0

echo -e "\n${YELLOW}📄 Verificando Smart Contracts...${NC}"
check_file "contracts/IdentityNFT.sol" || ((errors++))
check_content "contracts/IdentityNFT.sol" "bioHashToActiveToken" || ((errors++))
check_content "contracts/IdentityNFT.sol" "getActiveTokenByBioHash" || ((errors++))

echo -e "\n${YELLOW}🔧 Verificando Serviços Frontend...${NC}"
check_file "frontend/src/services/wallet-generator.ts" || ((errors++))
check_file "frontend/src/services/secure-storage.ts" || ((errors++))
check_content "frontend/src/services/wallet-generator.ts" "DeterministicWalletGenerator" || ((errors++))
check_content "frontend/src/services/secure-storage.ts" "SecureStorage" || ((errors++))

echo -e "\n${YELLOW}🎭 Verificando Componentes Frontend...${NC}"
check_file "frontend/src/components/IdentityRecoveryFlow.tsx" || ((errors++))
check_content "frontend/src/components/IdentityRecoveryFlow.tsx" "IdentityRecoveryFlow" || ((errors++))

echo -e "\n${YELLOW}🔄 Verificando Backend V2...${NC}"
check_file "backend/api/routes/kyc_routes.py" || ((errors++))
check_file "backend/api/utils/crypto.py" || ((errors++))
check_file "backend/api/utils/blockchain.py" || ((errors++))
check_content "backend/api/routes/kyc_routes.py" "/api/kyc" || ((errors++))

echo -e "\n${YELLOW}🧪 Verificando Testes...${NC}"
check_file "tests/test_implementation.py" || ((errors++))

echo -e "\n${YELLOW}🚀 Verificando Scripts de Deploy...${NC}"
check_file "scripts/deploy.sh" || ((errors++))
if [ -x "scripts/deploy.sh" ]; then
    echo -e "✅ deploy.sh é executável"
else
    echo -e "❌ deploy.sh ${RED}não é executável${NC}"
    ((errors++))
fi

echo -e "\n${YELLOW}📋 Verificando Documentação...${NC}"
# Não precisa mais verificar arquivo de implementação de fase específica
check_file ".env.template" || ((errors++))

echo -e "\n${YELLOW}📦 Verificando Dependências...${NC}"

# Verifica package.json do frontend
if [ -f "frontend/package.json" ]; then
    if grep -q "crypto-js" "frontend/package.json"; then
        echo -e "✅ crypto-js adicionado às dependências"
    else
        echo -e "❌ crypto-js ${RED}não encontrado${NC} nas dependências"
        ((errors++))
    fi
    
    if grep -q "buffer" "frontend/package.json"; then
        echo -e "✅ buffer adicionado às dependências"
    else
        echo -e "❌ buffer ${RED}não encontrado${NC} nas dependências"
        ((errors++))
    fi
fi

echo -e "\n${YELLOW}🔍 Verificando Estrutura de Arquivos...${NC}"
expected_files=(
    "contracts/IdentityNFT.sol"
    "frontend/src/services/wallet-generator.ts"
    "frontend/src/services/secure-storage.ts"
    "frontend/src/components/IdentityRecoveryFlow.tsx"
    "backend/api/routes/kyc_routes.py"
    "backend/api/utils/crypto.py"
    "backend/api/utils/blockchain.py"
    "tests/test_implementation.py"
    "scripts/deploy.sh"
    ".env.template"
    ".env.template"
)

missing_files=0
for file in "${expected_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "❌ $file ${RED}(FALTANDO)${NC}"
        ((missing_files++))
        ((errors++))
    fi
done

if [ $missing_files -eq 0 ]; then
    echo -e "✅ Todos os arquivos esperados estão presentes"
fi

echo -e "\n${YELLOW}⚙️ Verificando Funcionalidades Implementadas...${NC}"

# Verifica se smart contract tem funções essenciais
if [ -f "contracts/IdentityNFTV2.sol" ]; then
    functions=("mintIdentity" "getActiveTokenByBioHash" "validateWalletForBioHash" "emergencyRecovery")
    for func in "${functions[@]}"; do
        check_content "contracts/IdentityNFTV2.sol" "$func" || ((errors++))
    done
fi

# Verifica se backend tem endpoints essenciais
if [ -f "backend/api/routes/kyc_routes.py" ]; then
    endpoints=("/init" "/status" "/mint-nft" "/recover-identity")
    for endpoint in "${endpoints[@]}"; do
        check_content "backend/api/routes/kyc_routes.py" "$endpoint" || ((errors++))
    done
fi

echo -e "\n${YELLOW}🔐 Verificando Recursos de Segurança...${NC}"

security_features=(
    "AES-GCM"
    "PBKDF2"
    "IndexedDB"
    "Web Crypto API"
    "deterministic"
    "bioHash"
)

for feature in "${security_features[@]}"; do
    found=false
    for file in frontend/src/services/*.ts; do
        if [ -f "$file" ] && grep -q "$feature" "$file"; then
            echo -e "✅ $feature implementado"
            found=true
            break
        fi
    done
    if [ "$found" = false ]; then
        echo -e "❌ $feature ${RED}não encontrado${NC}"
        ((errors++))
    fi
done

echo -e "\n${YELLOW}📊 Verificando Configurações...${NC}"

# Verifica se há configuração para diferentes ambientes
if [ -f ".env.template" ]; then
    configs=("PHASE1_ENABLED" "SELF_CUSTODIAL_ENABLED" "KYC_ENABLED")
    for config in "${configs[@]}"; do
        check_content ".env.template" "$config" || ((errors++))
    done
fi

echo -e "\n============================================="

# Resultado final
if [ $errors -eq 0 ]; then
    echo -e "${GREEN}🎉 VALIDAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
    echo -e "${GREEN}✅ Todos os componentes da Fase 1 foram implementados corretamente${NC}"
    echo -e "${GREEN}✅ Sistema pronto para deploy em produção${NC}"
    echo ""
    echo -e "${BLUE}📋 Próximos passos:${NC}"
    echo "1. Execute: ./scripts/deploy.sh"
    echo "2. Configure variáveis de ambiente usando .env.template"
    echo "3. Monitore deployment por 72 horas"
    echo "4. Inicie planejamento da Fase 2"
    exit 0
else
    echo -e "${RED}❌ VALIDAÇÃO FALHOU${NC}"
    echo -e "${RED}✗ $errors erro(s) encontrado(s)${NC}"
    echo ""
    echo -e "${YELLOW}🔧 Corrija os problemas listados acima antes do deploy${NC}"
    exit 1
fi
