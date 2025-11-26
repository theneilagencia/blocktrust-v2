"""
Script para conceder MINTER_ROLE para o endereço do minter
"""
from web3 import Web3
from eth_account import Account
import json
import os
from dotenv import load_dotenv

load_dotenv()


def grant_minter_role():
    """Concede MINTER_ROLE para o endereço do minter"""
    
    # Conecta ao provider
    rpc_url = os.getenv('RPC_URL')
    if not rpc_url:
        raise Exception('RPC_URL não configurada')
    
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    
    if not w3.is_connected():
        raise Exception('Não foi possível conectar ao provider')
    
    # Carrega contrato
    contract_address = os.getenv('IDENTITY_NFT_ADDRESS')
    if not contract_address:
        raise Exception('IDENTITY_NFT_ADDRESS não configurada')
    
    abi_path = os.path.join(
        os.path.dirname(__file__), '..', 'contracts', 'IdentityNFT.json'
    )
    with open(abi_path) as f:
        contract_abi = json.load(f)['abi']
    
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(contract_address),
        abi=contract_abi
    )
    
    # Conta admin (que deployou o contrato)
    admin_private_key = os.getenv('ADMIN_PRIVATE_KEY')
    if not admin_private_key:
        raise Exception('ADMIN_PRIVATE_KEY não configurada')
    
    admin_account = Account.from_key(admin_private_key)
    
    # Endereço do minter
    minter_address = os.getenv('MINTER_ADDRESS')
    if not minter_address:
        raise Exception('MINTER_ADDRESS não configurada')
    
    # MINTER_ROLE hash
    minter_role = Web3.keccak(text='MINTER_ROLE')
    
    # Verifica se já tem a role
    has_role = contract.functions.hasRole(minter_role, minter_address).call()
    
    if has_role:
        print(f"✅ {minter_address} já possui MINTER_ROLE")
        return
    
    print(f"Concedendo MINTER_ROLE para {minter_address}...")
    
    # Concede role
    tx = contract.functions.grantRole(
        minter_role,
        Web3.to_checksum_address(minter_address)
    ).build_transaction({
        'from': admin_account.address,
        'nonce': w3.eth.get_transaction_count(admin_account.address),
        'gas': 200000,
        'gasPrice': w3.eth.gas_price,
        'chainId': w3.eth.chain_id
    })
    
    # Assina e envia
    signed_tx = w3.eth.account.sign_transaction(tx, admin_private_key)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
    
    print(f"Transação enviada: {tx_hash.hex()}")
    print("Aguardando confirmação...")
    
    # Aguarda confirmação
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    
    if receipt['status'] == 1:
        print(f"✅ MINTER_ROLE concedida para {minter_address}")
        print(f"Block: {receipt['blockNumber']}")
        print(f"Gas usado: {receipt['gasUsed']}")
    else:
        print("❌ Transação falhou")


if __name__ == '__main__':
    grant_minter_role()
