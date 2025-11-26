import os
import requests

TOOLBLOX_MINT_URL = os.getenv('TOOLBLOX_MINT_IDENTITY_URL')
TOOLBLOX_SIGNATURE_URL = os.getenv('TOOLBLOX_REGISTER_SIGNATURE_URL')
TOOLBLOX_VERIFY_URL = os.getenv('TOOLBLOX_VERIFY_URL')
TOOLBLOX_NETWORK = os.getenv('TOOLBLOX_NETWORK', 'amoy')

def mint_identity(wallet, proof_cid):
    """Mint de identidade via Toolblox"""
    response = requests.post(TOOLBLOX_MINT_URL, json={
        'wallet': wallet,
        'proof_cid': proof_cid,
        'network': TOOLBLOX_NETWORK
    }, timeout=30)
    return response.json()

def register_signature(doc_hash, signer):
    """Registra assinatura via Toolblox"""
    response = requests.post(TOOLBLOX_SIGNATURE_URL, json={
        'hash': doc_hash,
        'signer': signer,
        'network': TOOLBLOX_NETWORK
    }, timeout=30)
    return response.json()

def verify_document(doc_hash):
    """Verifica documento via Toolblox"""
    response = requests.post(TOOLBLOX_VERIFY_URL, json={
        'hash': doc_hash,
        'network': TOOLBLOX_NETWORK
    }, timeout=30)
    return response.json()

