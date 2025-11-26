-- Migration: Add admin features (audit_logs table and user roles)
-- Created: 2025-10-29

-- 1. Add role column to users table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';
    END IF;
END $$;

-- 2. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    role VARCHAR(20),
    action TEXT NOT NULL,
    endpoint TEXT,
    ip_address TEXT,
    user_agent TEXT,
    request_data JSONB,
    response_status INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- 4. Create JWT blacklist table
CREATE TABLE IF NOT EXISTS jwt_blacklist (
    id SERIAL PRIMARY KEY,
    jti VARCHAR(255) UNIQUE NOT NULL,
    token_type VARCHAR(20) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    revoked_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jwt_blacklist_jti ON jwt_blacklist(jti);
CREATE INDEX IF NOT EXISTS idx_jwt_blacklist_expires_at ON jwt_blacklist(expires_at);

-- 5. Update existing admin user (if exists) or create one
DO $$
BEGIN
    -- Check if admin@bts.com exists
    IF EXISTS (SELECT 1 FROM users WHERE email = 'admin@bts.com') THEN
        -- Update existing user to superadmin
        UPDATE users 
        SET role = 'superadmin' 
        WHERE email = 'admin@bts.com';
    ELSE
        -- Create new superadmin user
        -- Password: 123 (hashed with bcrypt)
        -- Hash: $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIr3TJUe4W
        INSERT INTO users (id, email, password_hash, role, created_at)
        VALUES (
            gen_random_uuid(),
            'admin@bts.com',
            '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIr3TJUe4W',
            'superadmin',
            NOW()
        )
        ON CONFLICT (email) DO UPDATE SET role = 'superadmin';
    END IF;
END $$;

-- 6. Add comment for documentation
COMMENT ON TABLE audit_logs IS 'Stores all admin and user actions for audit trail';
COMMENT ON TABLE jwt_blacklist IS 'Stores revoked JWT tokens for security';
COMMENT ON COLUMN users.role IS 'User role: user, admin, or superadmin';

