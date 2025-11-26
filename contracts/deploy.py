"""
Script de Deploy Automatizado para Smart Contracts Blocktrust
Deploy no Polygon Mumbai (Testnet)
"""

import os
import json
from web3 import Web3
from solcx import compile_standard, install_solc
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configurações
POLYGON_MUMBAI_RPC = os.getenv('POLYGON_RPC_URL', 'https://rpc-mumbai.maticvigil.com')
PRIVATE_KEY = os.getenv('DEPLOYER_PRIVATE_KEY')  # Chave privada do deployer
CHAIN_ID = 80001  # Polygon Mumbai

if not PRIVATE_KEY:
    logger.error("❌ DEPLOYER_PRIVATE_KEY não configurada!")
    logger.info("Configure com: export DEPLOYER_PRIVATE_KEY=0x...")
    exit(1)

# Conectar ao Polygon Mumbai
w3 = Web3(Web3.HTTPProvider(POLYGON_MUMBAI_RPC))

if not w3.is_connected():
    logger.error("❌ Não foi possível conectar ao Polygon Mumbai")
    exit(1)

logger.info(f"✅ Conectado ao Polygon Mumbai: {POLYGON_MUMBAI_RPC}")

# Conta do deployer
account = w3.eth.account.from_key(PRIVATE_KEY)
deployer_address = account.address
logger.info(f"📍 Deployer Address: {deployer_address}")

# Verificar saldo
balance = w3.eth.get_balance(deployer_address)
balance_matic = w3.from_wei(balance, 'ether')
logger.info(f"💰 Saldo: {balance_matic} MATIC")

if balance == 0:
    logger.warning("⚠️ Saldo zero! Obtenha MATIC de teste em: https://faucet.polygon.technology/")

def compile_contract(contract_name):
    """Compila um contrato Solidity"""
    logger.info(f"🔨 Compilando {contract_name}.sol...")
    
    with open(f'/home/ubuntu/bts-blocktrust/contracts/{contract_name}.sol', 'r') as file:
        contract_source = file.read()
    
    # Instalar solc se necessário
    try:
        install_solc('0.8.20')
    except:
        pass
    
    # Compilar
    compiled_sol = compile_standard(
        {
            "language": "Solidity",
            "sources": {f"{contract_name}.sol": {"content": contract_source}},
            "settings": {
                "outputSelection": {
                    "*": {
                        "*": ["abi", "metadata", "evm.bytecode", "evm.sourceMap"]
                    }
                },
                "optimizer": {
                    "enabled": True,
                    "runs": 200
                }
            },
        },
        solc_version="0.8.20",
        allow_paths=["/home/ubuntu/bts-blocktrust/contracts"]
    )
    
    # Extrair bytecode e ABI
    contract_data = compiled_sol['contracts'][f'{contract_name}.sol'][contract_name]
    bytecode = contract_data['evm']['bytecode']['object']
    abi = json.loads(contract_data['metadata'])['output']['abi']
    
    logger.info(f"✅ {contract_name} compilado com sucesso!")
    
    return bytecode, abi

def deploy_contract(contract_name, bytecode, abi, constructor_args=None):
    """Faz deploy de um contrato"""
    logger.info(f"🚀 Fazendo deploy de {contract_name}...")
    
    # Criar contrato
    Contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    
    # Preparar transação
    nonce = w3.eth.get_transaction_count(deployer_address)
    
    if constructor_args:
        transaction = Contract.constructor(*constructor_args).build_transaction({
            'chainId': CHAIN_ID,
            'gas': 3000000,
            'gasPrice': w3.eth.gas_price,
            'nonce': nonce,
        })
    else:
        transaction = Contract.constructor().build_transaction({
            'chainId': CHAIN_ID,
            'gas': 3000000,
            'gasPrice': w3.eth.gas_price,
            'nonce': nonce,
        })
    
    # Assinar transação
    signed_txn = w3.eth.account.sign_transaction(transaction, private_key=PRIVATE_KEY)
    
    # Enviar transação
    tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)
    logger.info(f"📤 Transação enviada: {tx_hash.hex()}")
    
    # Aguardar confirmação
    logger.info("⏳ Aguardando confirmação...")
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    
    contract_address = tx_receipt.contractAddress
    logger.info(f"✅ {contract_name} deployado em: {contract_address}")
    logger.info(f"🔗 PolygonScan: https://mumbai.polygonscan.com/address/{contract_address}")
    
    return contract_address, abi

def grant_role(contract_address, abi, role_name, role_hash, grantee_address):
    """Concede uma role a um endereço"""
    logger.info(f"🔐 Concedendo {role_name} para {grantee_address}...")
    
    contract = w3.eth.contract(address=contract_address, abi=abi)
    
    # Preparar transação
    nonce = w3.eth.get_transaction_count(deployer_address)
    
    transaction = contract.functions.grantRole(role_hash, grantee_address).build_transaction({
        'chainId': CHAIN_ID,
        'gas': 200000,
        'gasPrice': w3.eth.gas_price,
        'nonce': nonce,
    })
    
    # Assinar e enviar
    signed_txn = w3.eth.account.sign_transaction(transaction, private_key=PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)
    
    logger.info(f"📤 Transação enviada: {tx_hash.hex()}")
    
    # Aguardar confirmação
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    
    logger.info(f"✅ {role_name} concedida com sucesso!")
    
    return tx_hash.hex()

def main():
    """Executa o deploy completo"""
    logger.info("=" * 60)
    logger.info("🚀 DEPLOY DE SMART CONTRACTS BLOCKTRUST V1.1")
    logger.info("=" * 60)
    
    deployed_contracts = {}
    
    # 1. Deploy IdentityNFT
    logger.info("\n📜 FASE 1: Deploy IdentityNFT")
    logger.info("-" * 60)
    
    identity_bytecode, identity_abi = compile_contract('IdentityNFT')
    identity_address, identity_abi = deploy_contract(
        'IdentityNFT',
        identity_bytecode,
        identity_abi,
        constructor_args=[deployer_address]  # admin
    )
    
    deployed_contracts['IDENTITY_NFT_CONTRACT_ADDRESS'] = identity_address
    
    # 2. Deploy ProofRegistry
    logger.info("\n📜 FASE 2: Deploy ProofRegistry")
    logger.info("-" * 60)
    
    proof_bytecode, proof_abi = compile_contract('ProofRegistry')
    proof_address, proof_abi = deploy_contract(
        'ProofRegistry',
        proof_bytecode,
        proof_abi,
        constructor_args=[identity_address]  # identityContract
    )
    
    deployed_contracts['PROOF_REGISTRY_CONTRACT_ADDRESS'] = proof_address
    
    # 3. Deploy FailSafe
    logger.info("\n📜 FASE 3: Deploy FailSafe")
    logger.info("-" * 60)
    
    failsafe_bytecode, failsafe_abi = compile_contract('FailSafe')
    failsafe_address, failsafe_abi = deploy_contract(
        'FailSafe',
        failsafe_bytecode,
        failsafe_abi,
        constructor_args=[deployer_address, identity_address]  # admin, identityContract
    )
    
    deployed_contracts['FAILSAFE_CONTRACT_ADDRESS'] = failsafe_address
    
    # 4. Configurar Roles
    logger.info("\n🔐 FASE 4: Configurar Roles")
    logger.info("-" * 60)
    
    # MINTER_ROLE para backend (usar o mesmo deployer por enquanto)
    MINTER_ROLE = w3.keccak(text="MINTER_ROLE")
    grant_role(identity_address, identity_abi, "MINTER_ROLE", MINTER_ROLE, deployer_address)
    
    # CANCELER_ROLE para FailSafe
    CANCELER_ROLE = w3.keccak(text="CANCELER_ROLE")
    grant_role(identity_address, identity_abi, "CANCELER_ROLE", CANCELER_ROLE, failsafe_address)
    
    # SECURITY_ROLE para backend (usar o mesmo deployer por enquanto)
    SECURITY_ROLE = w3.keccak(text="SECURITY_ROLE")
    grant_role(failsafe_address, failsafe_abi, "SECURITY_ROLE", SECURITY_ROLE, deployer_address)
    
    # 5. Salvar endereços
    logger.info("\n💾 FASE 5: Salvar Configurações")
    logger.info("-" * 60)
    
    # Salvar em arquivo .env.contracts
    with open('/home/ubuntu/bts-blocktrust/.env.contracts', 'w') as f:
        f.write("# Smart Contracts Blocktrust v1.1 - Polygon Mumbai\n")
        f.write(f"IDENTITY_NFT_CONTRACT_ADDRESS={identity_address}\n")
        f.write(f"PROOF_REGISTRY_CONTRACT_ADDRESS={proof_address}\n")
        f.write(f"FAILSAFE_CONTRACT_ADDRESS={failsafe_address}\n")
        f.write(f"CHAIN_ID=80001\n")
        f.write(f"DEPLOYER_ADDRESS={deployer_address}\n")
    
    logger.info("✅ Configurações salvas em .env.contracts")
    
    # Salvar ABIs
    with open('/home/ubuntu/bts-blocktrust/contracts/IdentityNFT.abi.json', 'w') as f:
        json.dump(identity_abi, f, indent=2)
    
    with open('/home/ubuntu/bts-blocktrust/contracts/ProofRegistry.abi.json', 'w') as f:
        json.dump(proof_abi, f, indent=2)
    
    with open('/home/ubuntu/bts-blocktrust/contracts/FailSafe.abi.json', 'w') as f:
        json.dump(failsafe_abi, f, indent=2)
    
    logger.info("✅ ABIs salvos em contracts/*.abi.json")
    
    # Resumo final
    logger.info("\n" + "=" * 60)
    logger.info("✅ DEPLOY CONCLUÍDO COM SUCESSO!")
    logger.info("=" * 60)
    logger.info("\n📋 RESUMO DOS CONTRATOS:")
    logger.info(f"  IdentityNFT:    {identity_address}")
    logger.info(f"  ProofRegistry:  {proof_address}")
    logger.info(f"  FailSafe:       {failsafe_address}")
    logger.info("\n🔗 LINKS:")
    logger.info(f"  IdentityNFT:    https://mumbai.polygonscan.com/address/{identity_address}")
    logger.info(f"  ProofRegistry:  https://mumbai.polygonscan.com/address/{proof_address}")
    logger.info(f"  FailSafe:       https://mumbai.polygonscan.com/address/{failsafe_address}")
    logger.info("\n📝 PRÓXIMOS PASSOS:")
    logger.info("  1. Copiar endereços para variáveis de ambiente do Render")
    logger.info("  2. Atualizar backend/api/utils/nft.py com os novos endereços")
    logger.info("  3. Executar testes de integração")
    logger.info("=" * 60)

if __name__ == '__main__':
    main()

