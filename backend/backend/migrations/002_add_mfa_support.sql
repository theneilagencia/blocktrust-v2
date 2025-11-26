-- Migration 002: Add MFA support to users table
-- Add MFA-related columns to users table

ALTER TABLE users 
ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN mfa_secret TEXT,
ADD COLUMN backup_codes TEXT;

-- Create index for faster lookups
CREATE INDEX idx_users_mfa_enabled ON users(mfa_enabled);

-- Add some security constraints
ALTER TABLE users 
ADD CONSTRAINT check_mfa_secret_when_enabled 
CHECK (
    (mfa_enabled = FALSE) OR 
    (mfa_enabled = TRUE AND mfa_secret IS NOT NULL)
);

COMMENT ON COLUMN users.mfa_enabled IS 'Whether MFA/2FA is enabled for this user';
COMMENT ON COLUMN users.mfa_secret IS 'TOTP secret key (base32 encoded)';
COMMENT ON COLUMN users.backup_codes IS 'JSON array of backup codes (hashed)';
