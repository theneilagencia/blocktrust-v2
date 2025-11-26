"""
Script de Compilação de Contratos - Blocktrust v1.4
Compila contratos Solidity e salva ABIs
"""

import json
import os
from solcx import compile_standard, install_solc
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Instalar solc 0.8.20
try:
    install_solc('0.8.20')
    logger.info("✅ Solc 0.8.20 instalado")
except:
    logger.info("ℹ️ Solc 0.8.20 já instalado")

# Diretórios
CONTRACTS_DIR = "/home/ubuntu/bts-blocktrust/contracts"
OUTPUT_DIR = "/home/ubuntu/bts-blocktrust/backend/config"

os.makedirs(OUTPUT_DIR, exist_ok=True)

def compile_contract(contract_name):
    """Compila um contrato Solidity"""
    logger.info(f"🔨 Compilando {contract_name}.sol...")
    
    contract_path = f"{CONTRACTS_DIR}/{contract_name}.sol"
    
    with open(contract_path, 'r') as f:
        source_code = f.read()
    
    # Compilar
    compiled_sol = compile_standard(
        {
            "language": "Solidity",
            "sources": {
                f"{contract_name}.sol": {"content": source_code}
            },
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
        solc_version="0.8.20"
    )
    
    # Extrair bytecode e ABI
    contract_data = compiled_sol['contracts'][f'{contract_name}.sol'][contract_name]
    bytecode = contract_data['evm']['bytecode']['object']
    abi = json.loads(contract_data['metadata'])['output']['abi']
    
    logger.info(f"✅ {contract_name} compilado com sucesso!")
    
    return bytecode, abi

def main():
    """Compila todos os contratos e salva configuração"""
    logger.info("=" * 60)
    logger.info("🚀 COMPILAÇÃO DE CONTRATOS BLOCKTRUST V1.4")
    logger.info("=" * 60)
    
    contracts_config = {}
    
    # Compilar cada contrato
    for contract_name in ["IdentityNFT", "ProofRegistry", "FailSafe"]:
        try:
            bytecode, abi = compile_contract(contract_name)
            
            contracts_config[contract_name] = {
                "bytecode": bytecode,
                "abi": abi
            }
            
        except Exception as e:
            logger.error(f"❌ Erro ao compilar {contract_name}: {str(e)}")
            return False
    
    # Salvar configuração
    config_path = f"{OUTPUT_DIR}/contracts_compiled.json"
    
    with open(config_path, 'w') as f:
        json.dump(contracts_config, f, indent=2)
    
    logger.info(f"\n💾 Configuração salva em: {config_path}")
    logger.info("=" * 60)
    logger.info("✅ COMPILAÇÃO CONCLUÍDA COM SUCESSO!")
    logger.info("=" * 60)
    
    return True

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)

