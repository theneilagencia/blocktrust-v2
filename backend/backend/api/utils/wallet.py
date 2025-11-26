"""
Módulo de Carteira Proprietária Local
Implementa geração, armazenamento e assinatura de chaves criptográficas
sem dependência de MetaMask ou extensões externas.
"""

import os
import hashlib
import hmac
import secrets
import json
import logging
from typing import Dict, Tuple, Optional
from eth_account import Account
from eth_account.messages import encode_defunct
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import base64

logger = logging.getLogger(__name__)

class WalletManager:
    """Gerenciador de carteiras proprietárias locais"""
    
    def __init__(self):
        """Inicializa o gerenciador de carteiras"""
        self.backend = default_backend()
    
    def _derive_key_from_password(self, password: str, salt: bytes) -> bytes:
        """
        Deriva uma chave de criptografia a partir de uma senha usando PBKDF2
        
        Args:
            password: Senha do usuário
            salt: Salt para derivação
            
        Returns:
            Chave derivada de 32 bytes
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=10000,  # Reduzido para melhorar performance no Render
            backend=self.backend
        )
        return base64.urlsafe_b64encode(kdf.derive(password.encode()))
    
    def generate_wallet(self, password: str) -> Dict:
        """
        Gera uma nova carteira com chave privada secp256k1
        
        Args:
            password: Senha para criptografar a chave privada
            
        Returns:
            Dict com wallet_id, address, encrypted_private_key, salt
        """
        try:
            # Gerar chave privada usando eth_account
            account = Account.create()
            private_key = account.key.hex()
            address = account.address
            
            # Gerar salt aleatório
            salt = secrets.token_bytes(16)
            
            # Derivar chave de criptografia da senha
            encryption_key = self._derive_key_from_password(password, salt)
            
            # Criptografar chave privada
            fernet = Fernet(encryption_key)
            encrypted_private_key = fernet.encrypt(private_key.encode())
            
            # Gerar wallet_id único
            wallet_id = hashlib.sha256(f"{address}{salt.hex()}".encode()).hexdigest()[:16]
            
            logger.info(f"✅ Carteira gerada com sucesso: {address}")
            
            return {
                'wallet_id': wallet_id,
                'address': address,
                'encrypted_private_key': encrypted_private_key.decode(),
                'salt': base64.b64encode(salt).decode(),
                'public_key': address  # Endereço Ethereum é derivado da chave pública
            }
            
        except Exception as e:
            logger.error(f"❌ Erro ao gerar carteira: {str(e)}")
            raise
    
    def decrypt_private_key(self, encrypted_private_key: str, password: str, salt: str) -> str:
        """
        Descriptografa a chave privada usando a senha
        
        Args:
            encrypted_private_key: Chave privada criptografada
            password: Senha do usuário
            salt: Salt usado na derivação
            
        Returns:
            Chave privada descriptografada
        """
        try:
            # Decodificar salt
            salt_bytes = base64.b64decode(salt)
            
            # Derivar chave de criptografia
            encryption_key = self._derive_key_from_password(password, salt_bytes)
            
            # Descriptografar
            fernet = Fernet(encryption_key)
            private_key = fernet.decrypt(encrypted_private_key.encode()).decode()
            
            return private_key
            
        except Exception as e:
            logger.error(f"❌ Erro ao descriptografar chave privada: {str(e)}")
            raise ValueError("Senha incorreta ou chave corrompida")
    
    def sign_message(self, message: str, encrypted_private_key: str, password: str, salt: str) -> Dict:
        """
        Assina uma mensagem usando a chave privada
        
        Args:
            message: Mensagem a ser assinada
            encrypted_private_key: Chave privada criptografada
            password: Senha do usuário
            salt: Salt usado na derivação
            
        Returns:
            Dict com signature, message_hash, address
        """
        try:
            # Descriptografar chave privada
            private_key = self.decrypt_private_key(encrypted_private_key, password, salt)
            
            # Criar conta a partir da chave privada
            account = Account.from_key(private_key)
            
            # Codificar mensagem no formato Ethereum
            message_encoded = encode_defunct(text=message)
            
            # Assinar mensagem
            signed_message = account.sign_message(message_encoded)
            
            logger.info(f"✅ Mensagem assinada com sucesso: {account.address}")
            
            return {
                'signature': signed_message.signature.hex(),
                'message_hash': signed_message.messageHash.hex(),
                'address': account.address,
                'r': hex(signed_message.r),
                's': hex(signed_message.s),
                'v': signed_message.v
            }
            
        except ValueError as e:
            logger.error(f"❌ Senha incorreta: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"❌ Erro ao assinar mensagem: {str(e)}")
            raise
    
    def sign_transaction(self, transaction: Dict, encrypted_private_key: str, password: str, salt: str) -> str:
        """
        Assina uma transação blockchain
        
        Args:
            transaction: Dicionário com dados da transação
            encrypted_private_key: Chave privada criptografada
            password: Senha do usuário
            salt: Salt usado na derivação
            
        Returns:
            Transação assinada (raw transaction hex)
        """
        try:
            # Descriptografar chave privada
            private_key = self.decrypt_private_key(encrypted_private_key, password, salt)
            
            # Criar conta a partir da chave privada
            account = Account.from_key(private_key)
            
            # Assinar transação
            signed_txn = account.sign_transaction(transaction)
            
            logger.info(f"✅ Transação assinada com sucesso: {account.address}")
            
            return signed_txn.rawTransaction.hex()
            
        except ValueError as e:
            logger.error(f"❌ Senha incorreta: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"❌ Erro ao assinar transação: {str(e)}")
            raise
    
    def verify_signature(self, message: str, signature: str, address: str) -> bool:
        """
        Verifica se uma assinatura é válida
        
        Args:
            message: Mensagem original
            signature: Assinatura a ser verificada
            address: Endereço esperado do assinante
            
        Returns:
            True se a assinatura for válida, False caso contrário
        """
        try:
            # Codificar mensagem
            message_encoded = encode_defunct(text=message)
            
            # Recuperar endereço da assinatura
            recovered_address = Account.recover_message(message_encoded, signature=signature)
            
            # Comparar endereços
            is_valid = recovered_address.lower() == address.lower()
            
            if is_valid:
                logger.info(f"✅ Assinatura válida: {address}")
            else:
                logger.warning(f"⚠️ Assinatura inválida: esperado {address}, recuperado {recovered_address}")
            
            return is_valid
            
        except Exception as e:
            logger.error(f"❌ Erro ao verificar assinatura: {str(e)}")
            return False
    
    def generate_failsafe_signature(self, message: str) -> Dict:
        """
        Gera uma assinatura falsa para modo failsafe
        
        Args:
            message: Mensagem a ser "assinada"
            
        Returns:
            Dict com assinatura fake e flag failsafe
        """
        try:
            # Gerar hash fake
            fake_hash = hashlib.sha256(f"FAILSAFE_{message}_{secrets.token_hex(16)}".encode()).hexdigest()
            
            # Gerar assinatura fake
            fake_signature = "0x" + secrets.token_hex(65)
            
            logger.warning(f"🚨 FAILSAFE ACIONADO: Assinatura fake gerada")
            
            return {
                'signature': fake_signature,
                'message_hash': fake_hash,
                'address': '0x0000000000000000000000000000000000000000',
                'failsafe': True,
                'warning': 'ASSINATURA DE EMERGÊNCIA - NFT SERÁ CANCELADO'
            }
            
        except Exception as e:
            logger.error(f"❌ Erro ao gerar assinatura failsafe: {str(e)}")
            raise

# Instância global do gerenciador
wallet_manager = WalletManager()

