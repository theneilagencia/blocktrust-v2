#!/bin/bash

echo "=========================================="
echo "  BLOCKTRUST - STATUS DO SISTEMA"
echo "=========================================="
echo ""

# Backend
echo "🔌 Backend API:"
if curl -s http://localhost:10000/api/health > /dev/null 2>&1; then
    echo "   ✅ Rodando (porta 10000)"
    echo "   URL: https://10000-iys5mniiz7jb4wg6aawdx-d6669e93.manusvm.computer"
else
    echo "   ❌ Não está respondendo"
fi
echo ""

# Frontend
echo "🖥️  Frontend:"
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "   ✅ Rodando (porta 5173)"
    echo "   URL: https://5173-iys5mniiz7jb4wg6aawdx-d6669e93.manusvm.computer"
else
    echo "   ❌ Não está respondendo"
fi
echo ""

# PostgreSQL
echo "🗄️  PostgreSQL:"
if sudo service postgresql status | grep -q "active (exited)"; then
    echo "   ✅ Ativo"
else
    echo "   ❌ Inativo"
fi
echo ""

# Processos
echo "⚙️  Processos em execução:"
ps aux | grep -E "python3 app.py|node.*vite" | grep -v grep | wc -l | xargs echo "   Processos ativos:"
echo ""

echo "=========================================="
echo "Para mais detalhes, veja:"
echo "  - STATUS_SISTEMA.md"
echo "  - ACESSO_MANUS.md"
echo "=========================================="
