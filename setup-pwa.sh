#!/bin/bash

# Script de Setup Completo - Blocktrust PWA
# Este script configura todo o ambiente PWA automaticamente

set -e

echo "🚀 Iniciando setup do Blocktrust PWA..."
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Diretório base
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$BASE_DIR/frontend"
BACKEND_DIR="$BASE_DIR/backend"

# Função de log
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Verificar Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js não instalado. Instale em: https://nodejs.org/"
    exit 1
fi
log_success "Node.js $(node --version) encontrado"

# Verificar npm
if ! command -v npm &> /dev/null; then
    log_error "npm não instalado"
    exit 1
fi
log_success "npm $(npm --version) encontrado"

# Verificar Python
if ! command -v python3 &> /dev/null; then
    log_error "Python 3 não instalado"
    exit 1
fi
log_success "Python $(python3 --version) encontrado"

echo ""
log_info "Instalando dependências Frontend..."
cd "$FRONTEND_DIR"
npm install
log_success "Dependências Frontend instaladas"

echo ""
log_info "Instalando dependências Backend..."
cd "$BACKEND_DIR"
pip3 install pywebpush
log_success "Dependências Backend instaladas"

echo ""
log_info "Gerando chaves VAPID..."
cd "$BACKEND_DIR"
python3 scripts/generate_vapid_keys.py > vapid_keys.txt
log_success "Chaves VAPID geradas em backend/vapid_keys.txt"
log_warning "IMPORTANTE: Adicione as chaves ao arquivo .env"

echo ""
log_info "Verificando estrutura de pastas..."
mkdir -p "$FRONTEND_DIR/public/icons"
mkdir -p "$FRONTEND_DIR/public/screenshots"
log_success "Estrutura de pastas criada"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_success "Setup concluído com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo ""
echo "1. ${YELLOW}Gerar ícones PWA:${NC}"
echo "   - Acesse: https://www.pwabuilder.com/imageGenerator"
echo "   - Faça upload do logo do Blocktrust"
echo "   - Baixe e extraia em: frontend/public/icons/"
echo ""
echo "2. ${YELLOW}Configurar VAPID keys:${NC}"
echo "   - Abra: backend/vapid_keys.txt"
echo "   - Copie as chaves para o arquivo .env"
echo ""
echo "3. ${YELLOW}Atualizar index.html:${NC}"
echo "   - Adicione as meta tags PWA no <head>"
echo "   - Veja exemplo em: docs/PWA_IMPLEMENTATION.md"
echo ""
echo "4. ${YELLOW}Registrar Service Worker:${NC}"
echo "   - Adicione código em: frontend/src/main.tsx"
echo "   - Veja exemplo em: docs/PWA_README.md"
echo ""
echo "5. ${YELLOW}Testar:${NC}"
echo "   cd frontend"
echo "   npm run build"
echo "   npm run serve:pwa"
echo ""
echo "6. ${YELLOW}Auditoria Lighthouse:${NC}"
echo "   npm run lighthouse"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_info "Para mais informações, consulte: docs/PWA_README.md"
echo ""
