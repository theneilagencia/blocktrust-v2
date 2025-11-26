from datetime import datetime


class User:
    def __init__(self, id, email, password_hash, role='user', created_at=None,
                 mfa_enabled=False, mfa_secret=None, backup_codes=None):
        self.id = id
        self.email = email
        self.password_hash = password_hash
        self.role = role
        self.created_at = created_at or datetime.utcnow()
        self.mfa_enabled = mfa_enabled
        self.mfa_secret = mfa_secret
        self.backup_codes = backup_codes


class Identity:
    def __init__(self, id, user_id, wallet, proof_cid, token_id,
                 valid=True, created_at=None):
        self.id = id
        self.user_id = user_id
        self.wallet = wallet
        self.proof_cid = proof_cid
        self.token_id = token_id
        self.valid = valid
        self.created_at = created_at or datetime.utcnow()


class Signature:
    def __init__(self, id, user_id, hash, tx_hash, signer, created_at=None):
        self.id = id
        self.user_id = user_id
        self.hash = hash
        self.tx_hash = tx_hash
        self.signer = signer
        self.created_at = created_at or datetime.utcnow()


class Alert:
    def __init__(self, id, user_id, wallet, hash, note, created_at=None):
        self.id = id
        self.user_id = user_id
        self.wallet = wallet
        self.hash = hash
        self.note = note
        self.created_at = created_at or datetime.utcnow()


class AccessLog:
    def __init__(self, id, user_id, action, ip, created_at=None):
        self.id = id
        self.user_id = user_id
        self.action = action
        self.ip = ip
        self.created_at = created_at or datetime.utcnow()

