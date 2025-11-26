"""
Utilitários PGP - Blocktrust v1.4
Gerenciamento de chaves PGP e validação de assinaturas
"""

import gnupg
import hashlib
import logging
import os
import tempfile

logger = logging.getLogger(__name__)

# Diretório temporário para GPG
GPG_HOME = tempfile.mkdtemp()
gpg = gnupg.GPG(gnupghome=GPG_HOME)

def import_public_key(armored_pubkey):
    """
    Importa uma chave pública PGP
    
    Args:
        armored_pubkey: Chave pública em formato armored (ASCII)
    
    Returns:
        dict: {
            'success': bool,
            'fingerprint': str,
            'key_id': str,
            'uids': list,
            'error': str (se falhar)
        }
    """
    try:
        import_result = gpg.import_keys(armored_pubkey)
        
        if not import_result.fingerprints:
            return {
                'success': False,
                'error': 'Nenhuma chave válida encontrada'
            }
        
        fingerprint = import_result.fingerprints[0]
        
        # Obter informações da chave
        keys = gpg.list_keys()
        key_info = next((k for k in keys if k['fingerprint'] == fingerprint), None)
        
        if not key_info:
            return {
                'success': False,
                'error': 'Erro ao obter informações da chave'
            }
        
        logger.info(f"✅ Chave PGP importada: {fingerprint[:16]}...")
        
        return {
            'success': True,
            'fingerprint': fingerprint,
            'key_id': key_info['keyid'],
            'uids': key_info['uids'],
            'length': key_info['length'],
            'algo': key_info['algo']
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao importar chave PGP: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def verify_signature(data, signature, fingerprint):
    """
    Verifica uma assinatura PGP
    
    Args:
        data: Dados originais (bytes ou string)
        signature: Assinatura PGP (armored)
        fingerprint: Fingerprint da chave pública
    
    Returns:
        dict: {
            'valid': bool,
            'fingerprint': str,
            'timestamp': int,
            'error': str (se falhar)
        }
    """
    try:
        # Converter data para bytes se necessário
        if isinstance(data, str):
            data = data.encode('utf-8')
        
        # Verificar assinatura
        verified = gpg.verify_data(signature, data)
        
        if not verified:
            return {
                'valid': False,
                'error': 'Assinatura inválida ou chave não encontrada'
            }
        
        # Verificar se o fingerprint corresponde
        if verified.fingerprint.upper() != fingerprint.upper():
            return {
                'valid': False,
                'error': f'Fingerprint não corresponde: esperado {fingerprint}, obtido {verified.fingerprint}'
            }
        
        logger.info(f"✅ Assinatura PGP válida: {fingerprint[:16]}...")
        
        return {
            'valid': True,
            'fingerprint': verified.fingerprint,
            'timestamp': verified.timestamp,
            'username': verified.username
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao verificar assinatura PGP: {str(e)}")
        return {
            'valid': False,
            'error': str(e)
        }

def get_public_key(fingerprint):
    """
    Exporta uma chave pública pelo fingerprint
    
    Args:
        fingerprint: Fingerprint da chave
    
    Returns:
        str: Chave pública em formato armored (ou None se não encontrada)
    """
    try:
        keys = gpg.list_keys()
        key_info = next((k for k in keys if k['fingerprint'] == fingerprint), None)
        
        if not key_info:
            return None
        
        # Exportar chave
        public_key = gpg.export_keys(fingerprint)
        
        return public_key if public_key else None
        
    except Exception as e:
        logger.error(f"❌ Erro ao exportar chave PGP: {str(e)}")
        return None

def calculate_pgp_sig_hash(signature):
    """
    Calcula o hash SHA-256 de uma assinatura PGP
    
    Args:
        signature: Assinatura PGP (string)
    
    Returns:
        str: Hash SHA-256 em formato hexadecimal (0x...)
    """
    sig_bytes = signature.encode('utf-8') if isinstance(signature, str) else signature
    hash_bytes = hashlib.sha256(sig_bytes).digest()
    return '0x' + hash_bytes.hex()

def fingerprint_to_bytes20(fingerprint):
    """
    Converte um fingerprint PGP para bytes20 (formato Solidity)
    
    Args:
        fingerprint: Fingerprint PGP (40 caracteres hex)
    
    Returns:
        str: Fingerprint em formato bytes20 (0x...)
    """
    # Pegar os primeiros 20 bytes (40 caracteres hex)
    fp_clean = fingerprint.replace(' ', '').upper()
    
    if len(fp_clean) < 40:
        raise ValueError(f"Fingerprint muito curto: {len(fp_clean)} caracteres")
    
    # Pegar os últimos 40 caracteres (20 bytes)
    fp_bytes20 = fp_clean[-40:]
    
    return '0x' + fp_bytes20

def cleanup():
    """Remove diretório temporário do GPG"""
    import shutil
    try:
        shutil.rmtree(GPG_HOME)
        logger.info("✅ Diretório GPG temporário removido")
    except Exception as e:
        logger.error(f"❌ Erro ao remover diretório GPG: {str(e)}")

