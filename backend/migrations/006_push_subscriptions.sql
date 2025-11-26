-- Migration: Push Subscriptions Table
-- Created: 2025-11-16
-- Description: Tabela para armazenar subscriptions de push notifications PWA

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    
    -- Unique constraint: one subscription per user per endpoint
    UNIQUE(user_id, endpoint)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- Add comment to table
COMMENT ON TABLE push_subscriptions IS 'Armazena subscriptions de push notifications para PWA';
COMMENT ON COLUMN push_subscriptions.user_id IS 'ID do usuário (referência para users)';
COMMENT ON COLUMN push_subscriptions.endpoint IS 'URL endpoint do browser push service';
COMMENT ON COLUMN push_subscriptions.p256dh IS 'Chave pública P256DH para encryption';
COMMENT ON COLUMN push_subscriptions.auth IS 'Auth secret para encryption';
COMMENT ON COLUMN push_subscriptions.active IS 'Se a subscription está ativa';
COMMENT ON COLUMN push_subscriptions.last_used_at IS 'Última vez que notificação foi enviada';
