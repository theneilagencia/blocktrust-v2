"""
Script para gerar uma nova conta para ser usada como minter
"""
from eth_account import Account
import secrets


def generate_minter_account():
    """Gera uma nova conta para ser usada como minter"""
    
    # Gera chave privada aleatória
    private_key = "0x" + secrets.token_hex(32)
    
    # Cria conta
    account = Account.from_key(private_key)
    
    print("=" * 60)
    print("CONTA MINTER GERADA")
    print("=" * 60)
    print(f"Endereço: {account.address}")
    print(f"Chave Privada: {private_key}")
    print("=" * 60)
    print("\n⚠️  IMPORTANTE:")
    print("1. Guarde a chave privada em local seguro")
    print("2. Adicione ao .env como MINTER_PRIVATE_KEY")
    print("3. Envie ETH/MATIC para este endereço para pagar gas")
    print("4. Conceda MINTER_ROLE no contrato para este endereço")
    print("=" * 60)
    
    return account


if __name__ == '__main__':
    generate_minter_account()
