-- Migration 001: Complete Schema for Blocktrust v1.4
-- Cria todas as tabelas necessárias para o sistema

-- Tabela de usuários (base)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Campos de carteira
    wallet_id VARCHAR(255),
    wallet_address VARCHAR(255),
    encrypted_private_key TEXT,
    wallet_salt VARCHAR(255),
    
    -- Campos de NFT
    nft_id VARCHAR(255),
    nft_active BOOLEAN DEFAULT FALSE,
    nft_minted_at TIMESTAMP,
    nft_transaction_hash VARCHAR(255),
    
    -- Campos de KYC
    kyc_status VARCHAR(50) DEFAULT 'pending',
    kyc_applicant_id VARCHAR(255),
    kyc_review_status VARCHAR(50),
    kyc_completed_at TIMESTAMP,
    
    -- Campos de PGP
    pgp_fingerprint VARCHAR(255),
    pgp_public_key TEXT,
    pgp_imported_at TIMESTAMP,
    
    -- Campos de Failsafe
    failsafe_password_hash VARCHAR(255),
    failsafe_configured BOOLEAN DEFAULT FALSE,
    
    -- Campos de MFA
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    backup_codes TEXT
);

-- Tabela de eventos blockchain
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    contract_address VARCHAR(255),
    transaction_hash VARCHAR(255),
    block_number BIGINT,
    event_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para tabela events
CREATE INDEX IF NOT EXISTS idx_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_tx_hash ON events(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

-- Tabela de assinaturas de documentos
CREATE TABLE IF NOT EXISTS document_signatures (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    file_hash VARCHAR(255) NOT NULL,
    signature TEXT NOT NULL,
    document_name VARCHAR(255),
    failsafe BOOLEAN DEFAULT FALSE,
    blockchain_tx VARCHAR(255),
    pgp_signature TEXT,
    pgp_fingerprint VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para tabela document_signatures
CREATE INDEX IF NOT EXISTS idx_doc_sig_user_id ON document_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_file_hash ON document_signatures(file_hash);

-- Tabela de cancelamentos de NFT
CREATE TABLE IF NOT EXISTS nft_cancellations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    nft_id VARCHAR(255) NOT NULL,
    reason VARCHAR(255),
    transaction_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de eventos failsafe
CREATE TABLE IF NOT EXISTS failsafe_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    nft_id VARCHAR(255),
    document_hash VARCHAR(255),
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para tabela failsafe_events
CREATE INDEX IF NOT EXISTS idx_failsafe_user_id ON failsafe_events(user_id);
CREATE INDEX IF NOT EXISTS idx_failsafe_created_at ON failsafe_events(created_at);

-- Tabela de logs de assinatura dupla
CREATE TABLE IF NOT EXISTS dual_sign_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    doc_hash VARCHAR(255) NOT NULL,
    pgp_signature TEXT NOT NULL,
    pgp_fingerprint VARCHAR(255) NOT NULL,
    pgp_sig_hash VARCHAR(255) NOT NULL,
    nft_id VARCHAR(255),
    blockchain_tx VARCHAR(255),
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de métricas de monitoramento
CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    check_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    latency_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para tabela metrics
CREATE INDEX IF NOT EXISTS idx_check_name ON metrics(check_name);
CREATE INDEX IF NOT EXISTS idx_metrics_created_at ON metrics(created_at);

-- Tabela de heartbeat do listener
CREATE TABLE IF NOT EXISTS listener_heartbeat (
    id SERIAL PRIMARY KEY,
    last_block BIGINT,
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir heartbeat inicial
INSERT INTO listener_heartbeat (last_block, last_heartbeat)
VALUES (0, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- Migration: Adicionar colunas MFA se não existirem (para bancos existentes)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'mfa_enabled') THEN
        ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'mfa_secret') THEN
        ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'backup_codes') THEN
        ALTER TABLE users ADD COLUMN backup_codes TEXT;
    END IF;
END $$;

-- Migration: Adicionar colunas KYC adicionais se não existirem (para bancos existentes)
DO $$
BEGIN
    -- Coluna applicant_id (alias para kyc_applicant_id usado nas rotas)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'applicant_id') THEN
        ALTER TABLE users ADD COLUMN applicant_id VARCHAR(255);
    END IF;
    -- Coluna bio_hash_fingerprint para armazenar hash do bioHash
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bio_hash_fingerprint') THEN
        ALTER TABLE users ADD COLUMN bio_hash_fingerprint VARCHAR(255);
    END IF;
    -- Coluna nft_token_id para armazenar ID do NFT
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'nft_token_id') THEN
        ALTER TABLE users ADD COLUMN nft_token_id VARCHAR(255);
    END IF;
    -- Coluna nft_tx_hash para armazenar hash da transação do NFT
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'nft_tx_hash') THEN
        ALTER TABLE users ADD COLUMN nft_tx_hash VARCHAR(255);
    END IF;
    -- Coluna kyc_started_at para armazenar data de início do KYC
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'kyc_started_at') THEN
        ALTER TABLE users ADD COLUMN kyc_started_at TIMESTAMP;
    END IF;
    -- Coluna updated_at para armazenar data de última atualização
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updated_at') THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
    -- Coluna name para armazenar nome do usuário
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'name') THEN
        ALTER TABLE users ADD COLUMN name VARCHAR(255);
    END IF;
    -- Coluna document_number para armazenar número do documento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'document_number') THEN
        ALTER TABLE users ADD COLUMN document_number VARCHAR(255);
    END IF;
END $$;

-- Migration: Adicionar colunas faltantes na tabela document_signatures
DO $$
BEGIN
    -- Coluna document_url para armazenar URL do documento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_signatures' AND column_name = 'document_url') THEN
        ALTER TABLE document_signatures ADD COLUMN document_url TEXT;
    END IF;
    -- Coluna signed_at para armazenar data de assinatura
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_signatures' AND column_name = 'signed_at') THEN
        ALTER TABLE document_signatures ADD COLUMN signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Migration: Adicionar colunas faltantes na tabela failsafe_events
DO $$
BEGIN
    -- Coluna message para armazenar mensagem do evento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failsafe_events' AND column_name = 'message') THEN
        ALTER TABLE failsafe_events ADD COLUMN message TEXT;
    END IF;
    -- Coluna triggered_at para armazenar data de acionamento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failsafe_events' AND column_name = 'triggered_at') THEN
        ALTER TABLE failsafe_events ADD COLUMN triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
    -- Coluna nft_cancelled para indicar se NFT foi cancelado
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'failsafe_events' AND column_name = 'nft_cancelled') THEN
        ALTER TABLE failsafe_events ADD COLUMN nft_cancelled BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Migration: Adicionar colunas faltantes na tabela nft_cancellations
DO $$
BEGIN
    -- Coluna old_nft_id para armazenar ID antigo do NFT
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nft_cancellations' AND column_name = 'old_nft_id') THEN
        ALTER TABLE nft_cancellations ADD COLUMN old_nft_id VARCHAR(255);
    END IF;
    -- Coluna cancelled_at para armazenar data de cancelamento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nft_cancellations' AND column_name = 'cancelled_at') THEN
        ALTER TABLE nft_cancellations ADD COLUMN cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Migration: Adicionar coluna last_failsafe_trigger na tabela users
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_failsafe_trigger') THEN
        ALTER TABLE users ADD COLUMN last_failsafe_trigger TIMESTAMP;
    END IF;
END $$;

-- Comentários das tabelas
COMMENT ON TABLE users IS 'Tabela principal de usuários com todos os campos necessários';
COMMENT ON TABLE events IS 'Eventos capturados da blockchain pelo listener';
COMMENT ON TABLE document_signatures IS 'Registro de assinaturas de documentos (normal e failsafe)';
COMMENT ON TABLE nft_cancellations IS 'Histórico de cancelamentos de NFT';
COMMENT ON TABLE failsafe_events IS 'Auditoria de eventos de emergência (failsafe)';
COMMENT ON TABLE dual_sign_logs IS 'Logs de assinatura dupla (PGP + Blockchain)';
COMMENT ON TABLE metrics IS 'Métricas de monitoramento e health checks';
COMMENT ON TABLE listener_heartbeat IS 'Heartbeat do listener blockchain';

