#!/usr/bin/env python3
"""
Migration script para adicionar colunas de KYC na tabela users
"""
import os
from api.utils.db import get_db_connection

def migrate_kyc_columns():
    """Adiciona colunas de KYC na tabela users"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Adicionar colunas de KYC
        print("Adicionando colunas de KYC...")
        
        cur.execute("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS applicant_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(50) DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS sumsub_data JSONB,
            ADD COLUMN IF NOT EXISTS liveness_status VARCHAR(50),
            ADD COLUMN IF NOT EXISTS kyc_updated_at TIMESTAMP
        """)
        
        conn.commit()
        print("✅ Colunas de KYC adicionadas com sucesso!")
        
        # Verificar colunas
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        """)
        
        print("\nColunas da tabela users:")
        for row in cur.fetchall():
            print(f"  - {row['column_name']}: {row['data_type']}")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Erro na migration: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    migrate_kyc_columns()

