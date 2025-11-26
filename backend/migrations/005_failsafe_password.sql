-- Migration 005: Sistema de Senha de Emergência (Failsafe)

-- Adicionar campo para senha de emergência (failsafe)
ALTER TABLE users ADD COLUMN IF NOT EXISTS failsafe_password_hash VARCHAR(255);

-- Adicionar campo para indicar se failsafe foi configurado
ALTER TABLE users ADD COLUMN IF NOT EXISTS failsafe_configured BOOLEAN DEFAULT FALSE;

-- Adicionar campo para último acionamento de failsafe
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failsafe_trigger TIMESTAMP;

-- Comentários
COMMENT ON COLUMN users.failsafe_password_hash IS 'Hash da senha de emergência (failsafe)';
COMMENT ON COLUMN users.failsafe_configured IS 'Indica se o usuário configurou senha de emergência';
COMMENT ON COLUMN users.last_failsafe_trigger IS 'Última vez que o failsafe foi acionado';

