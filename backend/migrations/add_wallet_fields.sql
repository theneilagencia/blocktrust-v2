-- Adicionar campos de carteira na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_id VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42);
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_salt TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_created_at TIMESTAMP;

-- Criar tabela de eventos failsafe
CREATE TABLE IF NOT EXISTS failsafe_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    message TEXT,
    triggered_at TIMESTAMP DEFAULT NOW(),
    nft_cancelled BOOLEAN DEFAULT FALSE,
    new_nft_id INTEGER
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_failsafe_events_user_id ON failsafe_events(user_id);
