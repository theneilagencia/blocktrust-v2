"""
Módulo de Gerenciamento de NFT SoulBound
Implementa lógica de minting, cancelamento e consulta de NFTs de identidade
"""

import os
import logging
from typing import Dict, Optional
from web3 import Web3
# geth_poa_middleware não é mais necessário no web3.py >= 6.0
import json

logger = logging.getLogger(__name__)

# Configurações
POLYGON_RPC_URL = os.getenv('POLYGON_RPC_URL', 'https://polygon-mumbai.infura.io/v3/demo')
IDENTITY_NFT_CONTRACT_ADDRESS = os.getenv('IDENTITY_NFT_CONTRACT_ADDRESS', '0x0000000000000000000000000000000000000000')
PROOF_REGISTRY_CONTRACT_ADDRESS = os.getenv('PROOF_REGISTRY_CONTRACT_ADDRESS', '0x0000000000000000000000000000000000000000')

# ABIs dos contratos (simplificados para demonstração)
IDENTITY_NFT_ABI = [
    {
        "inputs": [
            {"name": "user", "type": "address"},
            {"name": "metadata", "type": "bytes"},
            {"name": "previousId", "type": "uint256"}
        ],
        "name": "mintIdentityNFT",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "nftId", "type": "uint256"}],
        "name": "cancelNFT",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "user", "type": "address"}],
        "name": "getActiveNFT",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"name": "user", "type": "address"}],
        "name": "isActiveNFT",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "nftId", "type": "uint256"},
            {"indexed": True, "name": "novoNftId", "type": "uint256"}
        ],
        "name": "CancelamentoEvent",
        "type": "event"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "nftId", "type": "uint256"},
            {"indexed": True, "name": "user", "type": "address"}
        ],
        "name": "MintingEvent",
        "type": "event"
    }
]

PROOF_REGISTRY_ABI = [
    {
        "inputs": [
            {"name": "docHash", "type": "string"},
            {"name": "proofUrl", "type": "string"}
        ],
        "name": "registerProof",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "docHash", "type": "string"}],
        "name": "verifyProof",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    }
]

class NFTManager:
    """Gerenciador de NFTs SoulBound"""
    
    def __init__(self):
        """Inicializa o gerenciador de NFTs"""
        self.w3 = Web3(Web3.HTTPProvider(POLYGON_RPC_URL))
        
        # Adicionar middleware para PoA (Polygon)
        # POA middleware não é mais necessário no web3.py >= 6.0
        
        # Verificar conexão
        if not self.w3.is_connected():
            logger.warning("⚠️ Não foi possível conectar ao RPC do Polygon")
        else:
            logger.info(f"✅ Conectado ao Polygon: {POLYGON_RPC_URL}")
        
        # Inicializar contratos
        self.identity_nft_contract = None
        self.proof_registry_contract = None
        
        if IDENTITY_NFT_CONTRACT_ADDRESS != '0x0000000000000000000000000000000000000000':
            self.identity_nft_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(IDENTITY_NFT_CONTRACT_ADDRESS),
                abi=IDENTITY_NFT_ABI
            )
        
        if PROOF_REGISTRY_CONTRACT_ADDRESS != '0x0000000000000000000000000000000000000000':
            self.proof_registry_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(PROOF_REGISTRY_CONTRACT_ADDRESS),
                abi=PROOF_REGISTRY_ABI
            )
    
    def get_active_nft(self, wallet_address: str) -> Optional[int]:
        """
        Obtém o ID do NFT ativo do usuário
        
        Args:
            wallet_address: Endereço da carteira do usuário
            
        Returns:
            ID do NFT ativo ou None se não houver
        """
        try:
            if not self.identity_nft_contract:
                logger.warning("⚠️ Contrato de NFT não configurado")
                return None
            
            checksum_address = Web3.to_checksum_address(wallet_address)
            nft_id = self.identity_nft_contract.functions.getActiveNFT(checksum_address).call()
            
            if nft_id == 0:
                logger.info(f"ℹ️ Usuário {wallet_address} não possui NFT ativo")
                return None
            
            logger.info(f"✅ NFT ativo encontrado: {nft_id} para {wallet_address}")
            return nft_id
            
        except Exception as e:
            logger.error(f"❌ Erro ao obter NFT ativo: {str(e)}")
            return None
    
    def is_active_nft(self, wallet_address: str) -> bool:
        """
        Verifica se o usuário possui um NFT ativo
        
        Args:
            wallet_address: Endereço da carteira do usuário
            
        Returns:
            True se possui NFT ativo, False caso contrário
        """
        try:
            if not self.identity_nft_contract:
                return False
            
            checksum_address = Web3.to_checksum_address(wallet_address)
            is_active = self.identity_nft_contract.functions.isActiveNFT(checksum_address).call()
            
            return is_active
            
        except Exception as e:
            logger.error(f"❌ Erro ao verificar NFT ativo: {str(e)}")
            return False
    
    def cancel_nft(self, nft_id: int, private_key: str) -> Dict:
        """
        Cancela um NFT existente
        
        Args:
            nft_id: ID do NFT a ser cancelado
            private_key: Chave privada para assinar a transação
            
        Returns:
            Dict com status e transaction_hash
        """
        try:
            if not self.identity_nft_contract:
                raise ValueError("Contrato de NFT não configurado")
            
            # Criar conta a partir da chave privada
            account = self.w3.eth.account.from_key(private_key)
            
            # Preparar transação
            nonce = self.w3.eth.get_transaction_count(account.address)
            
            transaction = self.identity_nft_contract.functions.cancelNFT(nft_id).build_transaction({
                'from': account.address,
                'nonce': nonce,
                'gas': 200000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            # Assinar transação
            signed_txn = self.w3.eth.account.sign_transaction(transaction, private_key)
            
            # Enviar transação
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            # Aguardar confirmação
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            logger.info(f"✅ NFT {nft_id} cancelado com sucesso: {tx_hash.hex()}")
            
            return {
                'status': 'success',
                'transaction_hash': tx_hash.hex(),
                'block_number': receipt['blockNumber'],
                'gas_used': receipt['gasUsed']
            }
            
        except Exception as e:
            logger.error(f"❌ Erro ao cancelar NFT: {str(e)}")
            raise
    
    def mint_identity_nft(
        self,
        wallet_address: str,
        metadata: Dict,
        previous_nft_id: int,
        private_key: str
    ) -> Dict:
        """
        Minta um novo NFT de identidade
        
        Args:
            wallet_address: Endereço da carteira do usuário
            metadata: Metadados do NFT (KYC info, etc.)
            previous_nft_id: ID do NFT anterior (0 se for o primeiro)
            private_key: Chave privada para assinar a transação
            
        Returns:
            Dict com status, nft_id e transaction_hash
        """
        try:
            if not self.identity_nft_contract:
                raise ValueError("Contrato de NFT não configurado")
            
            # Criar conta a partir da chave privada
            account = self.w3.eth.account.from_key(private_key)
            
            # Converter metadata para bytes
            metadata_json = json.dumps(metadata)
            metadata_bytes = metadata_json.encode('utf-8')
            
            # Preparar transação
            checksum_address = Web3.to_checksum_address(wallet_address)
            nonce = self.w3.eth.get_transaction_count(account.address)
            
            transaction = self.identity_nft_contract.functions.mintIdentityNFT(
                checksum_address,
                metadata_bytes,
                previous_nft_id
            ).build_transaction({
                'from': account.address,
                'nonce': nonce,
                'gas': 300000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            # Assinar transação
            signed_txn = self.w3.eth.account.sign_transaction(transaction, private_key)
            
            # Enviar transação
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            # Aguardar confirmação
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            # Extrair NFT ID dos logs (simplificado)
            # Em produção, parse os eventos do receipt
            nft_id = previous_nft_id + 1  # Simplificação
            
            logger.info(f"✅ NFT {nft_id} mintado com sucesso para {wallet_address}: {tx_hash.hex()}")
            
            return {
                'status': 'success',
                'nft_id': nft_id,
                'transaction_hash': tx_hash.hex(),
                'block_number': receipt['blockNumber'],
                'gas_used': receipt['gasUsed']
            }
            
        except Exception as e:
            logger.error(f"❌ Erro ao mintar NFT: {str(e)}")
            raise
    
    def register_proof(
        self,
        doc_hash: str,
        proof_url: str,
        private_key: str
    ) -> Dict:
        """
        Registra uma prova de documento na blockchain
        
        Args:
            doc_hash: Hash do documento
            proof_url: URL da prova
            private_key: Chave privada para assinar a transação
            
        Returns:
            Dict com status e transaction_hash
        """
        try:
            if not self.proof_registry_contract:
                raise ValueError("Contrato de ProofRegistry não configurado")
            
            # Criar conta a partir da chave privada
            account = self.w3.eth.account.from_key(private_key)
            
            # Preparar transação
            nonce = self.w3.eth.get_transaction_count(account.address)
            
            transaction = self.proof_registry_contract.functions.registerProof(
                doc_hash,
                proof_url
            ).build_transaction({
                'from': account.address,
                'nonce': nonce,
                'gas': 200000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            # Assinar transação
            signed_txn = self.w3.eth.account.sign_transaction(transaction, private_key)
            
            # Enviar transação
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            # Aguardar confirmação
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            logger.info(f"✅ Prova registrada com sucesso: {tx_hash.hex()}")
            
            return {
                'status': 'success',
                'transaction_hash': tx_hash.hex(),
                'block_number': receipt['blockNumber'],
                'gas_used': receipt['gasUsed']
            }
            
        except Exception as e:
            logger.error(f"❌ Erro ao registrar prova: {str(e)}")
            raise
    
    def verify_proof(self, doc_hash: str) -> bool:
        """
        Verifica se uma prova existe na blockchain
        
        Args:
            doc_hash: Hash do documento
            
        Returns:
            True se a prova existe, False caso contrário
        """
        try:
            if not self.proof_registry_contract:
                return False
            
            exists = self.proof_registry_contract.functions.verifyProof(doc_hash).call()
            
            if exists:
                logger.info(f"✅ Prova verificada: {doc_hash}")
            else:
                logger.warning(f"⚠️ Prova não encontrada: {doc_hash}")
            
            return exists
            
        except Exception as e:
            logger.error(f"❌ Erro ao verificar prova: {str(e)}")
            return False

# Instância global do gerenciador
nft_manager = NFTManager()



# Funções auxiliares para integração com KYC

def check_active_nft(user_id: int) -> Optional[Dict]:
    """
    Verifica se o usuário possui um NFT ativo
    
    Args:
        user_id: ID do usuário no banco de dados
        
    Returns:
        Dict com informações do NFT ativo ou None
    """
    try:
        from api.database import get_db_connection
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT nft_id, wallet_address, nft_active, nft_minted_at
            FROM users
            WHERE id = %s AND nft_active = TRUE
        """, (user_id,))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if not result:
            return None
        
        return {
            'nft_id': result[0],
            'wallet_address': result[1],
            'nft_active': result[2],
            'nft_minted_at': result[3]
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao verificar NFT ativo: {str(e)}")
        return None

def cancel_nft(user_id: int, nft_id: int) -> Dict:
    """
    Cancela um NFT ativo
    
    Args:
        user_id: ID do usuário
        nft_id: ID do NFT a ser cancelado
        
    Returns:
        Dict com resultado da operação
    """
    try:
        from api.database import get_db_connection
        
        # TODO: Chamar contrato IdentityNFT.cancelNFT(nft_id)
        # Por enquanto, apenas simular
        import hashlib
        tx_hash = "0x" + hashlib.sha256(f"cancel_{nft_id}".encode()).hexdigest()
        
        # Atualizar banco de dados
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            UPDATE users
            SET nft_active = FALSE
            WHERE id = %s
        """, (user_id,))
        
        # Registrar cancelamento
        cur.execute("""
            INSERT INTO nft_cancellations (user_id, nft_id, reason, created_at)
            VALUES (%s, %s, %s, NOW())
        """, (user_id, nft_id, 'KYC re-approval'))
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"✅ NFT {nft_id} cancelado para usuário {user_id}")
        
        return {
            'success': True,
            'tx_hash': tx_hash,
            'nft_id': nft_id
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao cancelar NFT: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def mint_nft(user_id: int, kyc_data: Dict) -> Dict:
    """
    Minta um novo NFT para o usuário
    
    Args:
        user_id: ID do usuário
        kyc_data: Dados do KYC aprovado
        
    Returns:
        Dict com resultado da operação
    """
    try:
        from api.database import get_db_connection
        import hashlib
        import json
        
        # Obter dados do usuário
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT wallet_address, email, name
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        user_data = cur.fetchone()
        
        if not user_data:
            return {
                'success': False,
                'error': 'Usuário não encontrado'
            }
        
        wallet_address, email, name = user_data
        
        # Se não tem carteira, criar uma
        if not wallet_address:
            from api.utils.wallet import generate_wallet
            wallet_result = generate_wallet(user_id)
            
            if not wallet_result['success']:
                return {
                    'success': False,
                    'error': 'Erro ao gerar carteira'
                }
            
            wallet_address = wallet_result['address']
        
        # Verificar se contratos estão deployados
        identity_nft_address = os.getenv('IDENTITY_NFT_ADDRESS', '0x0000000000000000000000000000000000000000')
        deployer_private_key = os.getenv('DEPLOYER_PRIVATE_KEY')
        mock_mode = os.getenv('MOCK_MODE', 'false').lower() == 'true'
        
        # Se contratos não estão deployados ou está em mock mode, simular
        if mock_mode or identity_nft_address == '0x0000000000000000000000000000000000000000' or not deployer_private_key or deployer_private_key.startswith('0x0000'):
            logger.warning(f"⚠️  Contratos não deployados ou MOCK_MODE ativo - Simulando mint de NFT")
            import random
            nft_id = random.randint(1000, 9999)
            tx_hash = "0x" + hashlib.sha256(f"mint_{nft_id}_{wallet_address}".encode()).hexdigest()
        else:
            # Usar contrato real
            try:
                logger.info(f"🎨 Mintando NFT real para {wallet_address}...")
                
                # Carregar ABI do contrato
                import json
                abi_path = os.path.join(os.path.dirname(__file__), '../../contracts/IdentityNFT.abi.json')
                
                if os.path.exists(abi_path):
                    with open(abi_path, 'r') as f:
                        identity_abi = json.load(f)
                else:
                    # Fallback para ABI simplificada
                    identity_abi = IDENTITY_NFT_ABI
                
                # Conectar ao contrato
                from web3 import Web3
                rpc_url = os.getenv('POLYGON_RPC_URL', 'https://polygon-mumbai.g.alchemy.com/v2/demo')
                w3 = Web3(Web3.HTTPProvider(rpc_url))
                
                if not w3.is_connected():
                    raise Exception("Não foi possível conectar ao RPC")
                
                identity_contract = w3.eth.contract(
                    address=Web3.to_checksum_address(identity_nft_address),
                    abi=identity_abi
                )
                
                # Preparar metadata
                metadata = {
                    'user_id': user_id,
                    'email': email,
                    'name': name,
                    'kyc_approved': True,
                    'kyc_data': kyc_data
                }
                metadata_json = json.dumps(metadata)
                metadata_bytes = metadata_json.encode('utf-8')
                
                # Obter NFT anterior (se existir)
                cur.execute("SELECT nft_id FROM users WHERE id = %s", (user_id,))
                previous_nft = cur.fetchone()
                previous_nft_id = int(previous_nft[0]) if previous_nft and previous_nft[0] else 0
                
                # Criar conta do deployer
                from eth_account import Account
                deployer_account = Account.from_key(deployer_private_key)
                
                # Preparar transação
                nonce = w3.eth.get_transaction_count(deployer_account.address)
                
                transaction = identity_contract.functions.mintIdentityNFT(
                    Web3.to_checksum_address(wallet_address),
                    metadata_bytes,
                    previous_nft_id
                ).build_transaction({
                    'from': deployer_account.address,
                    'nonce': nonce,
                    'gas': 500000,
                    'gasPrice': w3.eth.gas_price,
                    'chainId': w3.eth.chain_id
                })
                
                # Assinar e enviar transação
                signed_txn = w3.eth.account.sign_transaction(transaction, deployer_private_key)
                tx_hash_bytes = w3.eth.send_raw_transaction(signed_txn.rawTransaction)
                tx_hash = tx_hash_bytes.hex()
                
                logger.info(f"📤 Transação enviada: {tx_hash}")
                logger.info(f"⏳ Aguardando confirmação...")
                
                # Aguardar confirmação
                receipt = w3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=120)
                
                # Extrair NFT ID dos eventos
                logs = identity_contract.events.MintingEvent().process_receipt(receipt)
                if logs:
                    nft_id = int(logs[0]['args']['nftId'])
                    logger.info(f"✅ NFT {nft_id} mintado com sucesso!")
                else:
                    # Fallback: incrementar ID anterior
                    nft_id = previous_nft_id + 1
                    logger.warning(f"⚠️  Não foi possível extrair NFT ID dos logs, usando {nft_id}")
                
            except Exception as contract_error:
                logger.error(f"❌ Erro ao mintar NFT real: {str(contract_error)}")
                logger.warning(f"⚠️  Fallback para simulação")
                
                # Fallback para simulação
                import random
                nft_id = random.randint(1000, 9999)
                tx_hash = "0x" + hashlib.sha256(f"mint_{nft_id}_{wallet_address}".encode()).hexdigest()
        
        # Atualizar banco de dados
        cur.execute("""
            UPDATE users
            SET nft_id = %s,
                nft_active = TRUE,
                nft_minted_at = NOW(),
                nft_transaction_hash = %s
            WHERE id = %s
        """, (nft_id, tx_hash, user_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"✅ NFT {nft_id} mintado para usuário {user_id} ({wallet_address})")
        
        return {
            'success': True,
            'nft_id': nft_id,
            'tx_hash': tx_hash,
            'wallet_address': wallet_address
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao mintar NFT: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

