# Script para gerar VAPID keys para Push Notifications

from pywebpush import Vapid
import os

def generate_vapid_keys():
    """
    Gera par de chaves VAPID para Web Push
    """
    print("🔑 Gerando VAPID keys para Push Notifications...\n")
    
    # Gerar chaves
    vapid_key = Vapid()
    vapid_key.generate_keys()
    
    # Obter chaves em formato PEM
    private_key = vapid_key.private_pem().decode('utf-8')
    public_key = vapid_key.public_pem().decode('utf-8')
    
    print("✅ Chaves geradas com sucesso!\n")
    print("📋 Adicione as seguintes variáveis ao seu arquivo .env:\n")
    print(f"VAPID_PRIVATE_KEY={private_key}")
    print(f"VAPID_PUBLIC_KEY={public_key}")
    print("\n⚠️  IMPORTANTE: Mantenha a chave privada em segredo!")
    print("⚠️  Não compartilhe ou commit a chave privada no git!")
    print("\n💡 DICA: Copie as chaves acima e adicione ao seu arquivo .env")
    
    return {
        'private_key': private_key,
        'public_key': public_key
    }


if __name__ == '__main__':
    generate_vapid_keys()
