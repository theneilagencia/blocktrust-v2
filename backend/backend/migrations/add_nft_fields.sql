-- Adicionar campos de NFT na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS nft_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nft_active BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nft_minted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nft_transaction_hash VARCHAR(66);

-- Criar tabela de cancelamentos de NFT
CREATE TABLE IF NOT EXISTS nft_cancellations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    old_nft_id INTEGER NOT NULL,
    cancelled_at TIMESTAMP DEFAULT NOW(),
    transaction_hash VARCHAR(66),
    reason TEXT,
    new_nft_id INTEGER
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_users_nft_id ON users(nft_id);
CREATE INDEX IF NOT EXISTS idx_nft_cancellations_user_id ON nft_cancellations(user_id);
CREATE INDEX IF NOT EXISTS idx_nft_cancellations_old_nft_id ON nft_cancellations(old_nft_id);
