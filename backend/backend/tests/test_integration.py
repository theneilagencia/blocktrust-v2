"""
Testes de Integração - Blocktrust v1.2
Testa fluxo completo: usuário, carteira, NFT, assinatura e failsafe
"""

import pytest
import requests
import json
import hashlib
import time

# Configurações
BASE_URL = "http://localhost:10000"
ADMIN_EMAIL = "admin@bts.com"
ADMIN_PASSWORD = "123"

class TestBlocktrustIntegration:
    """Testes de integração do sistema Blocktrust"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Obtém token JWT do admin"""
        response = requests.post(f"{BASE_URL}/api/explorer/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()['token']
    
    @pytest.fixture(scope="class")
    def user_credentials(self):
        """Cria usuário de teste"""
        email = f"test_{int(time.time())}@test.com"
        password = "test123"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password,
            "name": "Test User"
        })
        
        assert response.status_code == 201
        
        return {"email": email, "password": password}
    
    @pytest.fixture(scope="class")
    def user_token(self, user_credentials):
        """Faz login do usuário de teste"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": user_credentials['email'],
            "password": user_credentials['password']
        })
        
        assert response.status_code == 200
        return response.json()['token']
    
    def test_1_health_check(self):
        """Teste 1: Verificar se API está online"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert response.json()['status'] == 'ok'
        print("✅ Teste 1: Health check OK")
    
    def test_2_admin_login(self, admin_token):
        """Teste 2: Login do admin"""
        assert admin_token is not None
        assert len(admin_token) > 0
        print("✅ Teste 2: Admin login OK")
    
    def test_3_user_registration(self, user_credentials):
        """Teste 3: Registro de usuário"""
        assert user_credentials['email'] is not None
        print(f"✅ Teste 3: Usuário criado: {user_credentials['email']}")
    
    def test_4_user_login(self, user_token):
        """Teste 4: Login do usuário"""
        assert user_token is not None
        assert len(user_token) > 0
        print("✅ Teste 4: User login OK")
    
    def test_5_wallet_creation(self, user_token):
        """Teste 5: Criação de carteira"""
        response = requests.post(
            f"{BASE_URL}/api/wallet/init",
            json={"password": "test123"},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert 'address' in data
        assert data['address'].startswith('0x')
        print(f"✅ Teste 5: Carteira criada: {data['address']}")
    
    def test_6_wallet_info(self, user_token):
        """Teste 6: Obter informações da carteira"""
        response = requests.get(
            f"{BASE_URL}/api/wallet/info",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'address' in data
        print(f"✅ Teste 6: Info da carteira obtida: {data['address']}")
    
    def test_7_sign_message(self, user_token):
        """Teste 7: Assinar mensagem"""
        message = "Test message for signature"
        
        response = requests.post(
            f"{BASE_URL}/api/wallet/sign",
            json={"message": message, "password": "test123"},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'signature' in data
        assert data['signature'].startswith('0x')
        print(f"✅ Teste 7: Mensagem assinada: {data['signature'][:20]}...")
    
    def test_8_verify_signature(self, user_token):
        """Teste 8: Verificar assinatura"""
        # Primeiro assinar
        message = "Test message for verification"
        
        sign_response = requests.post(
            f"{BASE_URL}/api/wallet/sign",
            json={"message": message, "password": "test123"},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert sign_response.status_code == 200
        sign_data = sign_response.json()
        
        # Depois verificar
        verify_response = requests.post(
            f"{BASE_URL}/api/wallet/verify",
            json={
                "message": message,
                "signature": sign_data['signature'],
                "address": sign_data['address']
            }
        )
        
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data['valid'] == True
        print("✅ Teste 8: Assinatura verificada com sucesso")
    
    def test_9_hash_file(self, user_token):
        """Teste 9: Gerar hash de arquivo"""
        file_content = "Test document content"
        
        response = requests.post(
            f"{BASE_URL}/api/signature/hash-file",
            json={"file_content": file_content},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'file_hash' in data
        
        # Verificar se o hash está correto
        expected_hash = hashlib.sha256(file_content.encode()).hexdigest()
        assert data['file_hash'] == expected_hash
        print(f"✅ Teste 9: Hash gerado: {data['file_hash'][:16]}...")
    
    def test_10_get_contracts(self):
        """Teste 10: Obter endereços dos contratos"""
        response = requests.get(f"{BASE_URL}/api/explorer/contracts")
        
        # Pode retornar 404 se contratos não foram deployados
        if response.status_code == 200:
            data = response.json()
            assert 'contracts' in data
            print("✅ Teste 10: Contratos obtidos")
        else:
            print("⚠️ Teste 10: Contratos não deployados (esperado)")
    
    def test_11_get_events(self, admin_token):
        """Teste 11: Obter eventos da blockchain"""
        response = requests.get(
            f"{BASE_URL}/api/explorer/events",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'events' in data
        assert isinstance(data['events'], list)
        print(f"✅ Teste 11: {len(data['events'])} eventos obtidos")
    
    def test_12_get_stats(self):
        """Teste 12: Obter estatísticas"""
        response = requests.get(f"{BASE_URL}/api/explorer/stats")
        
        assert response.status_code == 200
        data = response.json()
        assert 'stats' in data
        assert 'total_events' in data['stats']
        print(f"✅ Teste 12: Estatísticas obtidas (total: {data['stats']['total_events']})")
    
    def test_13_failsafe_signature(self, user_token):
        """Teste 13: Assinatura failsafe"""
        message = "Failsafe test message"
        
        response = requests.post(
            f"{BASE_URL}/api/wallet/sign",
            json={"message": message, "password": "test123", "failsafe": True},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['failsafe'] == True
        assert 'warning' in data
        print("✅ Teste 13: Failsafe acionado com sucesso")

def run_tests():
    """Executa todos os testes"""
    print("\n" + "=" * 60)
    print("🧪 INICIANDO TESTES DE INTEGRAÇÃO - BLOCKTRUST V1.2")
    print("=" * 60 + "\n")
    
    # Executar pytest
    pytest.main([__file__, "-v", "--tb=short"])
    
    print("\n" + "=" * 60)
    print("✅ TESTES CONCLUÍDOS")
    print("=" * 60)

if __name__ == '__main__':
    run_tests()

