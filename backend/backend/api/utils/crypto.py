"""
Utilitários de criptografia para o sistema
"""
import hashlib
import re

def validate_bio_hash(bio_hash: str) -> bool:
    """
    Valida se o bioHash está no formato correto
    
    Args:
        bio_hash: String do bioHash a ser validado
        
    Returns:
        bool: True se válido, False caso contrário
    """
    if not bio_hash or not isinstance(bio_hash, str):
        return False
    
    # Deve ter pelo menos 32 caracteres
    if len(bio_hash) < 32:
        return False
    
    # Deve ser hexadecimal válido (opcional - depende do formato do Sumsub)
    # if not re.match(r'^[a-fA-F0-9]+$', bio_hash):
    #     return False
    
    return True

def hash_bio_data(bio_data: str) -> str:
    """
    Cria hash dos dados biométricos
    
    Args:
        bio_data: Dados biométricos brutos
        
    Returns:
        str: Hash SHA-256 dos dados
    """
    return hashlib.sha256(bio_data.encode()).hexdigest()

def create_bio_fingerprint(bio_hash: str) -> str:
    """
    Cria fingerprint do bioHash para armazenamento seguro
    
    Args:
        bio_hash: Hash biométrico original
        
    Returns:
        str: Fingerprint para armazenamento no banco
    """
    return hashlib.sha256(bio_hash.encode()).hexdigest()
