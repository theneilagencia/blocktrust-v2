-- Criar tabela de assinaturas de documentos
CREATE TABLE IF NOT EXISTS document_signatures (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    file_hash VARCHAR(64) NOT NULL,
    signature TEXT NOT NULL,
    document_name VARCHAR(255),
    document_url TEXT,
    failsafe BOOLEAN DEFAULT FALSE,
    blockchain_tx VARCHAR(66),
    signed_at TIMESTAMP DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_document_signatures_user_id ON document_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_file_hash ON document_signatures(file_hash);
CREATE INDEX IF NOT EXISTS idx_document_signatures_failsafe ON document_signatures(failsafe);
CREATE INDEX IF NOT EXISTS idx_document_signatures_signed_at ON document_signatures(signed_at DESC);
