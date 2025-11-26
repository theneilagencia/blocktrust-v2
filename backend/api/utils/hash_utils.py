import hashlib

def calculate_sha256(file_bytes):
    """Calcula o hash SHA-256 de um arquivo"""
    return hashlib.sha256(file_bytes).hexdigest()

def verify_hash(file_bytes, expected_hash):
    """Verifica se o hash de um arquivo corresponde ao esperado"""
    calculated = calculate_sha256(file_bytes)
    return calculated == expected_hash

