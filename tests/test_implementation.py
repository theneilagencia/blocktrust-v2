"""
Testes para o sistema de geração determinística de wallets
"""
import pytest
import sys
import os

# Adiciona o diretório frontend/src ao path para importar os módulos
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src'))

from services.wallet_generator import DeterministicWalletGenerator

class TestWalletGeneration:
    """Testes para geração determinística de wallets"""
    
    def test_same_biohash_generates_same_wallet(self):
        """Teste: mesmo bioHash deve gerar a mesma wallet"""
        bio_hash = 'test-bio-hash-12345678901234567890'
        
        wallet1 = DeterministicWalletGenerator.generateWallet(bio_hash)
        wallet2 = DeterministicWalletGenerator.generateWallet(bio_hash)
        
        assert wallet1.address == wallet2.address
        assert wallet1.privateKey == wallet2.privateKey
    
    def test_different_biohash_generates_different_wallets(self):
        """Teste: bioHashes diferentes devem gerar wallets diferentes"""
        bio_hash1 = 'test-bio-hash-1-12345678901234567890'
        bio_hash2 = 'test-bio-hash-2-12345678901234567890'
        
        wallet1 = DeterministicWalletGenerator.generateWallet(bio_hash1)
        wallet2 = DeterministicWalletGenerator.generateWallet(bio_hash2)
        
        assert wallet1.address != wallet2.address
        assert wallet1.privateKey != wallet2.privateKey
    
    def test_salt_affects_generation(self):
        """Teste: salt diferente deve gerar wallets diferentes"""
        bio_hash = 'test-bio-hash-12345678901234567890'
        
        wallet1 = DeterministicWalletGenerator.generateWallet(bio_hash, {'salt': 'salt1'})
        wallet2 = DeterministicWalletGenerator.generateWallet(bio_hash, {'salt': 'salt2'})
        
        assert wallet1.address != wallet2.address
        assert wallet1.privateKey != wallet2.privateKey
    
    def test_validate_address_for_biohash(self):
        """Teste: validação de endereço para bioHash"""
        bio_hash = 'test-bio-hash-12345678901234567890'
        wallet = DeterministicWalletGenerator.generateWallet(bio_hash)
        
        # Deve validar corretamente
        assert DeterministicWalletGenerator.validateAddressForBioHash(
            wallet.address, bio_hash
        ) == True
        
        # Deve falhar para endereço diferente
        assert DeterministicWalletGenerator.validateAddressForBioHash(
            '0x1234567890123456789012345678901234567890', bio_hash
        ) == False
    
    def test_biohash_quality_analysis(self):
        """Teste: análise da qualidade do bioHash"""
        # BioHash válido
        valid_hash = 'a1b2c3d4e5f6' * 5  # 60 caracteres
        analysis = DeterministicWalletGenerator.analyzeBioHashQuality(valid_hash)
        
        assert analysis['length'] == 60
        assert analysis['isValid'] == True
        assert len(analysis['recommendations']) == 0
        
        # BioHash muito curto
        short_hash = 'short'
        analysis = DeterministicWalletGenerator.analyzeBioHashQuality(short_hash)
        
        assert analysis['isValid'] == False
        assert 'pelo menos 32 caracteres' in analysis['recommendations'][0]
    
    def test_derive_multiple_wallets(self):
        """Teste: derivação de múltiplas wallets"""
        bio_hash = 'test-bio-hash-12345678901234567890'
        wallets = DeterministicWalletGenerator.deriveMultipleWallets(bio_hash, 3)
        
        assert len(wallets) == 3
        
        # Todas devem ser diferentes
        addresses = [w.address for w in wallets]
        assert len(set(addresses)) == 3
    
    def test_invalid_biohash_raises_error(self):
        """Teste: bioHash inválido deve gerar erro"""
        with pytest.raises(Exception) as exc_info:
            DeterministicWalletGenerator.generateWallet('short')
        
        assert 'inválido' in str(exc_info.value)
    
    def test_production_vs_development_config(self):
        """Teste: configurações diferentes devem gerar wallets diferentes"""
        bio_hash = 'test-bio-hash-12345678901234567890'
        
        from services.wallet_generator import PRODUCTION_CONFIG, DEVELOPMENT_CONFIG
        
        wallet_prod = DeterministicWalletGenerator.generateWallet(bio_hash, PRODUCTION_CONFIG)
        wallet_dev = DeterministicWalletGenerator.generateWallet(bio_hash, DEVELOPMENT_CONFIG)
        
        assert wallet_prod.address != wallet_dev.address

class TestSecureStorage:
    """Testes para armazenamento seguro (simulados)"""
    
    def test_storage_flow_simulation(self):
        """Teste simulado do fluxo de armazenamento"""
        # Este seria um teste mais complexo que testaria o IndexedDB
        # Para agora, apenas verificamos se a classe existe
        from services.secure_storage import SecureStorage
        assert SecureStorage is not None

class TestIdentityRecovery:
    """Testes para recuperação de identidade (simulados)"""
    
    def test_recovery_component_exists(self):
        """Verifica se o componente de recuperação existe"""
        # Teste básico para verificar se o componente pode ser importado
        # Em um ambiente real, usaríamos React Testing Library
        from components.IdentityRecoveryFlow import IdentityRecoveryFlow
        assert IdentityRecoveryFlow is not None

if __name__ == '__main__':
    pytest.main([__file__, '-v'])
