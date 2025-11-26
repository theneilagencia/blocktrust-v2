import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from .db_engine import test_connection, engine

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

# psycopg2 não aceita o prefixo +psycopg2, apenas SQLAlchemy aceita
# Remover +psycopg2 se presente na URL para compatibilidade com psycopg2
if DATABASE_URL and '+psycopg2' in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace('postgresql+psycopg2://', 'postgresql://')

# Testar conexão ao importar o módulo
test_connection()

def get_db_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Criar tabelas
    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'user',
            applicant_id VARCHAR(255),
            kyc_status VARCHAR(50) DEFAULT 'not_started',
            kyc_updated_at TIMESTAMP,
            sumsub_data TEXT,
            liveness_status VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Migration: Adicionar colunas de KYC se não existirem
    try:
        cur.execute('''
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS liveness_status VARCHAR(50)
        ''')
    except Exception as e:
        # Ignorar se a coluna já existir
        pass
    
    # Migration: Adicionar colunas de gerenciamento de usuários
    try:
        cur.execute('''
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
            ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free',
            ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS last_login TIMESTAMP
        ''')
    except Exception as e:
        # Ignorar se as colunas já existirem
        pass
    
    # Migration: Adicionar colunas de carteira
    try:
        cur.execute('''
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS wallet_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(255),
            ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT,
            ADD COLUMN IF NOT EXISTS wallet_salt VARCHAR(255),
            ADD COLUMN IF NOT EXISTS wallet_created_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS nft_active BOOLEAN DEFAULT FALSE
        ''')
    except Exception as e:
        # Ignorar se as colunas já existirem
        pass
    
    cur.execute('''
        CREATE TABLE IF NOT EXISTS identities (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            wallet VARCHAR(255) NOT NULL,
            proof_cid VARCHAR(255) NOT NULL,
            token_id VARCHAR(255),
            valid BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cur.execute('''
        CREATE TABLE IF NOT EXISTS signatures (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            hash VARCHAR(255) NOT NULL,
            tx_hash VARCHAR(255),
            signer VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cur.execute('''
        CREATE TABLE IF NOT EXISTS alerts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            wallet VARCHAR(255),
            hash VARCHAR(255),
            note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cur.execute('''
        CREATE TABLE IF NOT EXISTS access_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            action VARCHAR(255) NOT NULL,
            ip VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cur.execute('''
        CREATE TABLE IF NOT EXISTS document_registrations (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            file_hash VARCHAR(255) NOT NULL,
            document_name VARCHAR(500),
            document_url TEXT,
            blockchain_tx VARCHAR(255),
            registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Criar índices para document_registrations
    try:
        cur.execute('CREATE INDEX IF NOT EXISTS idx_doc_file_hash ON document_registrations(file_hash)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_doc_user_id ON document_registrations(user_id)')
    except Exception as e:
        # Ignorar se os índices já existirem
        pass
    
    conn.commit()
    cur.close()
    conn.close()

