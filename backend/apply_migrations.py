#!/usr/bin/env python3
"""
Script para aplicar migrations no banco de dados PostgreSQL
Pode ser executado localmente ou no Render
"""

import os
import psycopg2
from psycopg2 import sql

def apply_migrations():
    """Aplica todas as migrations SQL no banco de dados"""
    
    # Obter DATABASE_URL do ambiente
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ DATABASE_URL não encontrada nas variáveis de ambiente")
        return False
    
    print("🔗 Conectando ao banco de dados...")
    
    try:
        # Conectar ao banco
        conn = psycopg2.connect(database_url)
        conn.autocommit = False
        cur = conn.cursor()
        
        print("✅ Conectado com sucesso!")
        
        # Ler migration SQL
        migration_file = os.path.join(os.path.dirname(__file__), 'migrations', '001_complete_schema.sql')
        
        print(f"📄 Lendo migration: {migration_file}")
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        print("🚀 Aplicando migration...")
        
        # Executar migration
        cur.execute(migration_sql)
        
        # Commit
        conn.commit()
        
        print("✅ Migration aplicada com sucesso!")
        
        # Verificar tabelas criadas
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        """)
        
        tables = cur.fetchall()
        
        print(f"\n📊 Tabelas no banco de dados ({len(tables)}):")
        for table in tables:
            print(f"  - {table[0]}")
        
        # Fechar conexão
        cur.close()
        conn.close()
        
        print("\n🎉 Todas as migrations foram aplicadas com sucesso!")
        return True
        
    except Exception as e:
        print(f"❌ Erro ao aplicar migrations: {e}")
        if conn:
            conn.rollback()
            conn.close()
        return False

if __name__ == '__main__':
    success = apply_migrations()
    exit(0 if success else 1)

