-- Migration 004: PGP e Assinatura Dupla - Blocktrust v1.4

-- Adicionar campos PGP na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS pgp_fingerprint VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pgp_public_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pgp_imported_at TIMESTAMP;

-- Criar índice no fingerprint
CREATE INDEX IF NOT EXISTS idx_users_pgp_fingerprint ON users(pgp_fingerprint);

-- Criar tabela de logs de assinatura dupla
CREATE TABLE IF NOT EXISTS dual_sign_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    doc_hash VARCHAR(66) NOT NULL,
    pgp_fingerprint VARCHAR(40) NOT NULL,
    pgp_signature TEXT NOT NULL,
    pgp_sig_hash VARCHAR(66) NOT NULL,
    nft_id INTEGER,
    blockchain_tx VARCHAR(66),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_dual_sign_logs_user_id ON dual_sign_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_dual_sign_logs_doc_hash ON dual_sign_logs(doc_hash);
CREATE INDEX IF NOT EXISTS idx_dual_sign_logs_pgp_fingerprint ON dual_sign_logs(pgp_fingerprint);
CREATE INDEX IF NOT EXISTS idx_dual_sign_logs_created_at ON dual_sign_logs(created_at DESC);

-- Comentários
COMMENT ON TABLE dual_sign_logs IS 'Logs de assinaturas duplas (PGP + Blockchain)';
COMMENT ON COLUMN dual_sign_logs.doc_hash IS 'Hash SHA-256 do documento (0x...)';
COMMENT ON COLUMN dual_sign_logs.pgp_sig_hash IS 'Hash SHA-256 da assinatura PGP (0x...)';
COMMENT ON COLUMN dual_sign_logs.blockchain_tx IS 'Transaction hash do registro on-chain';
