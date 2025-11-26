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
    failsafe_configured BOOLEAN DEFAULT FALSE
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

-- Comentários das tabelas
COMMENT ON TABLE users IS 'Tabela principal de usuários com todos os campos necessários';
COMMENT ON TABLE events IS 'Eventos capturados da blockchain pelo listener';
COMMENT ON TABLE document_signatures IS 'Registro de assinaturas de documentos (normal e failsafe)';
COMMENT ON TABLE nft_cancellations IS 'Histórico de cancelamentos de NFT';
COMMENT ON TABLE failsafe_events IS 'Auditoria de eventos de emergência (failsafe)';
COMMENT ON TABLE dual_sign_logs IS 'Logs de assinatura dupla (PGP + Blockchain)';
COMMENT ON TABLE metrics IS 'Métricas de monitoramento e health checks';
COMMENT ON TABLE listener_heartbeat IS 'Heartbeat do listener blockchain';

