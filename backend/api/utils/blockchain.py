"""
Utilitários de blockchain para o sistema
"""
import hashlib
import json
import os
from web3 import Web3
from eth_account import Account
import logging

logger = logging.getLogger(__name__)


# Inicializa Web3
def get_web3():
    """Retorna instância do Web3 conectada ao provider"""
    rpc_url = os.getenv('RPC_URL')
    if not rpc_url:
        raise Exception('RPC_URL não configurada')
    
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    
    if not w3.is_connected():
        raise Exception('Não foi possível conectar ao provider')
    
    return w3


def get_contract():
    """Retorna instância do contrato IdentityNFT"""
    w3 = get_web3()
    
    contract_address = os.getenv('IDENTITY_NFT_ADDRESS')
    if not contract_address:
        raise Exception('IDENTITY_NFT_ADDRESS não configurada')
    
    # Carrega ABI do contrato
    abi_path = os.path.join(
        os.path.dirname(__file__), '..', '..', '..',
        'contracts', 'IdentityNFT.json'
    )
    
    if not os.path.exists(abi_path):
        raise Exception(f'ABI do contrato não encontrada em {abi_path}')
    
    with open(abi_path, 'r') as f:
        contract_json = json.load(f)
        contract_abi = contract_json.get('abi')
    
    if not contract_abi:
        raise Exception('ABI inválida no arquivo JSON')
    
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(contract_address),
        abi=contract_abi
    )
    
    return w3, contract


def generate_deterministic_address(bio_hash: str) -> str:
    """
    Gera endereço Ethereum determinístico a partir do bioHash
    
    Args:
        bio_hash: Hash biométrico único
        
    Returns:
        str: Endereço Ethereum
    """
    salt = 'blocktrust-deterministic'
    
    # Combina bioHash com salt
    seed_material = f"{bio_hash}:{salt}"
    
    # Deriva chave privada usando PBKDF2
    private_key_hash = hashlib.pbkdf2_hmac(
        'sha256',
        seed_material.encode(),
        salt.encode(),
        100000,  # iterations
        32       # key length
    )
    
    # Cria conta Ethereum
    account = Account.from_key(private_key_hash)
    
    return account.address


def validate_wallet_for_biohash(wallet_address: str, bio_hash: str) -> dict:
    """
    Valida se um endereço corresponde ao bioHash fornecido
    
    Args:
        wallet_address: Endereço da wallet a ser validado
        bio_hash: Hash biométrico
        
    Returns:
        dict: Resultado da validação
    """
    try:
        # Gera endereço esperado
        expected_address = generate_deterministic_address(bio_hash)
        
        # Valida endereço
        is_valid = wallet_address.lower() == expected_address.lower()
        
        if not is_valid:
            return {
                'valid': False,
                'expected_address': expected_address,
                'provided_address': wallet_address,
                'message': 'Endereço não corresponde ao bioHash'
            }
        
        # Conecta ao contrato
        w3, contract = get_contract()
        
        # Converte bioHash para bytes32
        bio_hash_bytes = Web3.keccak(text=bio_hash)
        
        # Consulta contrato
        try:
            token_id, owner = contract.functions.getActiveTokenByBioHash(
                bio_hash_bytes).call()
            
            # Recupera dados da identidade
            identity_data = contract.functions.identities(token_id).call()
            
            result = {
                'valid': True,
                'token_id': int(token_id),
                'owner': owner,
                'expected_address': expected_address,
                'provided_address': wallet_address,
                'identity_data': {
                    'name': identity_data[0],
                    'document_number': identity_data[1],
                    'bio_hash': identity_data[2].hex(),
                    'kyc_timestamp': int(identity_data[3]),
                    'is_active': identity_data[4],
                    'previous_token_id': int(identity_data[5]),
                    'applicant_id': identity_data[6]
                }
            }
            
            return result
            
        except Exception as contract_error:
            msg = f"Identidade não encontrada na blockchain: " \
                  f"{str(contract_error)}"
            logger.warning(msg)
            return {
                'valid': True,
                'expected_address': expected_address,
                'provided_address': wallet_address,
                'token_id': None,
                'message': 'Endereço válido mas NFT não encontrado'
            }
        
    except Exception as e:
        logger.error(f"Erro na validação wallet/bioHash: {str(e)}")
        return {
            'valid': False,
            'error': str(e)
        }


def mint_identity_nft(wallet_address: str, name: str, document_number: str,
                      bio_hash: str, applicant_id: str) -> dict:
    """
    Executa mint do NFT de identidade
    
    Args:
        wallet_address: Endereço da wallet determinística
        name: Nome completo do usuário
        document_number: Número do documento
        bio_hash: Hash biométrico
        applicant_id: ID do aplicante no Sumsub
        
    Returns:
        dict: Resultado do mint
    """
    try:
        # Conecta ao contrato
        w3, contract = get_contract()
        
        # Carrega conta do minter
        minter_private_key = os.getenv('MINTER_PRIVATE_KEY')
        if not minter_private_key:
            raise Exception('MINTER_PRIVATE_KEY não configurada')
        
        minter_account = Account.from_key(minter_private_key)
        
        # Converte bioHash para bytes32
        bio_hash_bytes = Web3.keccak(text=bio_hash)
        
        # Verifica se já existe NFT para este bioHash
        try:
            existing_token_id, _ = contract.functions.getActiveTokenByBioHash(
                bio_hash_bytes).call()
            if existing_token_id > 0:
                return {
                    'success': False,
                    'error': 'Já existe um NFT ativo para este bioHash',
                    'existing_token_id': int(existing_token_id)
                }
        except Exception:
            # Nenhum token existente, pode prosseguir
            pass
        
        # Prepara transação
        nonce = w3.eth.get_transaction_count(minter_account.address)
        
        # Estima gas
        try:
            gas_estimate = contract.functions.mintIdentity(
                Web3.to_checksum_address(wallet_address),
                name,
                document_number,
                bio_hash_bytes,
                applicant_id
            ).estimate_gas({'from': minter_account.address})
            
            # Adiciona 20% de margem
            gas_limit = int(gas_estimate * 1.2)
        except Exception as gas_error:
            msg = f"Erro ao estimar gas, usando valor padrão: " \
                  f"{str(gas_error)}"
            logger.warning(msg)
            gas_limit = 500000
        
        # Constrói transação
        tx = contract.functions.mintIdentity(
            Web3.to_checksum_address(wallet_address),
            name,
            document_number,
            bio_hash_bytes,
            applicant_id
        ).build_transaction({
            'from': minter_account.address,
            'nonce': nonce,
            'gas': gas_limit,
            'gasPrice': w3.eth.gas_price,
            'chainId': w3.eth.chain_id
        })
        
        # Assina transação
        signed_tx = w3.eth.account.sign_transaction(tx, minter_private_key)
        
        # Envia transação
        tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        
        logger.info(f"Transação de mint enviada: {tx_hash.hex()}")
        
        # Aguarda confirmação (timeout de 120 segundos)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        
        if receipt['status'] != 1:
            raise Exception('Transação falhou na blockchain')
        
        # Extrai tokenId dos logs
        logs = contract.events.IdentityMinted().process_receipt(receipt)
        
        if not logs:
            raise Exception('Evento IdentityMinted não encontrado nos logs')
        
        token_id = logs[0]['args']['tokenId']
        
        msg = f"NFT mintado com sucesso: Token {token_id} para " \
              f"{wallet_address}"
        logger.info(msg)
        
        return {
            'success': True,
            'token_id': int(token_id),
            'tx_hash': tx_hash.hex(),
            'wallet_address': wallet_address,
            'block_number': receipt['blockNumber'],
            'gas_used': receipt['gasUsed']
        }
        
    except Exception as e:
        logger.error(f"Erro no mint NFT: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }


def get_nft_by_token_id(token_id: int) -> dict:
    """
    Recupera dados de um NFT pelo tokenId
    
    Args:
        token_id: ID do token
        
    Returns:
        dict: Dados do NFT
    """
    try:
        w3, contract = get_contract()
        
        # Recupera dados da identidade
        identity_data = contract.functions.identities(token_id).call()
        
        # Recupera proprietário
        owner = contract.functions.ownerOf(token_id).call()
        
        return {
            'success': True,
            'token_id': token_id,
            'owner': owner,
            'identity_data': {
                'name': identity_data[0],
                'document_number': identity_data[1],
                'bio_hash': identity_data[2].hex(),
                'kyc_timestamp': int(identity_data[3]),
                'is_active': identity_data[4],
                'previous_token_id': int(identity_data[5]),
                'applicant_id': identity_data[6]
            }
        }
        
    except Exception as e:
        logger.error(f"Erro ao recuperar NFT: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
