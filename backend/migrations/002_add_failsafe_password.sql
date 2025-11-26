-- Migration 002: Adicionar coluna failsafe_password_hash
-- Adiciona suporte para senha de coação (failsafe)

-- Adicionar coluna failsafe_password_hash se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'failsafe_password_hash'
    ) THEN
        ALTER TABLE users ADD COLUMN failsafe_password_hash VARCHAR(255);
        ALTER TABLE users ADD COLUMN failsafe_configured BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

