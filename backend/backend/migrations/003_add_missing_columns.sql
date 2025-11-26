-- Migration 003: Adicionar colunas faltantes nas tabelas users e events
-- Data: 2025-10-29
-- Descrição: Adicionar colunas de wallet, NFT e KYC que faltam no banco de produção

-- Adicionar colunas faltantes na tabela users
DO $$
BEGIN
    -- Wallet
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'wallet_address') THEN
        ALTER TABLE users ADD COLUMN wallet_address VARCHAR(42);
    END IF;

    -- NFT
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'nft_id') THEN
        ALTER TABLE users ADD COLUMN nft_id INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'nft_active') THEN
        ALTER TABLE users ADD COLUMN nft_active BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'nft_minted_at') THEN
        ALTER TABLE users ADD COLUMN nft_minted_at TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'nft_transaction_hash') THEN
        ALTER TABLE users ADD COLUMN nft_transaction_hash VARCHAR(66);
    END IF;

    -- KYC (renomear applicant_id para kyc_applicant_id se necessário)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'kyc_applicant_id') THEN
        -- Criar nova coluna e copiar dados de applicant_id se existir
        ALTER TABLE users ADD COLUMN kyc_applicant_id VARCHAR(255);
        UPDATE users SET kyc_applicant_id = applicant_id WHERE applicant_id IS NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'kyc_review_status') THEN
        ALTER TABLE users ADD COLUMN kyc_review_status VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'kyc_completed_at') THEN
        ALTER TABLE users ADD COLUMN kyc_completed_at TIMESTAMP;
    END IF;
END $$;

-- Adicionar coluna type na tabela events se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'type') THEN
        ALTER TABLE events ADD COLUMN type VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'event_type') THEN
        ALTER TABLE events ADD COLUMN event_type VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'user_id') THEN
        ALTER TABLE events ADD COLUMN user_id INTEGER REFERENCES users(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'data') THEN
        ALTER TABLE events ADD COLUMN data JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'timestamp') THEN
        ALTER TABLE events ADD COLUMN timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_nft_id ON users(nft_id);
CREATE INDEX IF NOT EXISTS idx_users_kyc_applicant_id ON users(kyc_applicant_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);

