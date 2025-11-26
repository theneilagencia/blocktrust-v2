"""
Testes automatizados para a API do BTS Blocktrust
"""
import pytest
import sys
import os

# Adicionar o diretório backend ao path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import app
from api.utils.db import get_db_connection

@pytest.fixture
def client():
    """Fixture para cliente de teste do Flask"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

@pytest.fixture
def auth_token(client):
    """Fixture para obter token de autenticação"""
    # Registrar usuário de teste
    response = client.post('/api/auth/register', json={
        'email': f'test_{os.urandom(4).hex()}@test.com',
        'password': 'Test@12345678'
    })
    
    if response.status_code == 200:
        return response.json['token']
    
    # Se o registro falhar, tentar login
    response = client.post('/api/auth/login', json={
        'email': 'test@test.com',
        'password': 'Test@12345678'
    })
    
    return response.json['token']

class TestHealthCheck:
    """Testes para o endpoint de health check"""
    
    def test_health_check(self, client):
        """Testa se o endpoint de health check está funcionando"""
        response = client.get('/api/health')
        assert response.status_code == 200
        assert response.json['status'] == 'ok'
        assert 'service' in response.json

class TestAuthentication:
    """Testes para autenticação"""
    
    def test_register_success(self, client):
        """Testa registro de novo usuário"""
        email = f'newuser_{os.urandom(4).hex()}@test.com'
        response = client.post('/api/auth/register', json={
            'email': email,
            'password': 'ValidPass123!'
        })
        
        assert response.status_code == 200
        assert 'token' in response.json
        assert 'user' in response.json
        assert response.json['user']['email'] == email
    
    def test_register_missing_fields(self, client):
        """Testa registro sem campos obrigatórios"""
        response = client.post('/api/auth/register', json={
            'email': 'test@test.com'
        })
        
        assert response.status_code == 400
        assert 'error' in response.json
    
    def test_register_duplicate_email(self, client):
        """Testa registro com email duplicado"""
        email = f'duplicate_{os.urandom(4).hex()}@test.com'
        
        # Primeiro registro
        client.post('/api/auth/register', json={
            'email': email,
            'password': 'ValidPass123!'
        })
        
        # Segundo registro com mesmo email
        response = client.post('/api/auth/register', json={
            'email': email,
            'password': 'ValidPass123!'
        })
        
        assert response.status_code == 400
        assert 'error' in response.json
    
    def test_login_success(self, client):
        """Testa login com credenciais válidas"""
        email = f'loginuser_{os.urandom(4).hex()}@test.com'
        password = 'ValidPass123!'
        
        # Registrar usuário
        client.post('/api/auth/register', json={
            'email': email,
            'password': password
        })
        
        # Fazer login
        response = client.post('/api/auth/login', json={
            'email': email,
            'password': password
        })
        
        assert response.status_code == 200
        assert 'token' in response.json
        assert 'user' in response.json
    
    def test_login_invalid_credentials(self, client):
        """Testa login com credenciais inválidas"""
        response = client.post('/api/auth/login', json={
            'email': 'nonexistent@test.com',
            'password': 'WrongPassword123!'
        })
        
        assert response.status_code == 401
        assert 'error' in response.json

class TestProxyEndpoints:
    """Testes para endpoints de proxy (Toolblox)"""
    
    def test_verify_without_auth(self, client):
        """Testa endpoint de verificação sem autenticação"""
        response = client.post('/api/proxy/verify', json={
            'hash': '0x' + '0' * 64
        })
        
        assert response.status_code == 401
    
    def test_verify_missing_hash(self, client, auth_token):
        """Testa endpoint de verificação sem hash"""
        response = client.post('/api/proxy/verify', 
            json={},
            headers={'Authorization': f'Bearer {auth_token}'}
        )
        
        assert response.status_code == 400
        assert 'error' in response.json
    
    def test_signature_without_auth(self, client):
        """Testa endpoint de assinatura sem autenticação"""
        response = client.post('/api/proxy/signature', json={
            'hash': '0x' + '0' * 64,
            'signer': '0x' + '0' * 40
        })
        
        assert response.status_code == 401
    
    def test_signature_missing_fields(self, client, auth_token):
        """Testa endpoint de assinatura sem campos obrigatórios"""
        response = client.post('/api/proxy/signature',
            json={'hash': '0x' + '0' * 64},
            headers={'Authorization': f'Bearer {auth_token}'}
        )
        
        assert response.status_code == 400
        assert 'error' in response.json
    
    def test_identity_without_auth(self, client):
        """Testa endpoint de identidade sem autenticação"""
        response = client.post('/api/proxy/identity', json={
            'wallet': '0x' + '0' * 40,
            'proof_cid': 'QmTest123'
        })
        
        assert response.status_code == 401

class TestDatabase:
    """Testes para operações de banco de dados"""
    
    def test_db_connection(self):
        """Testa conexão com o banco de dados"""
        try:
            conn = get_db_connection()
            assert conn is not None
            
            cur = conn.cursor()
            cur.execute('SELECT 1')
            result = cur.fetchone()
            
            assert result is not None
            
            cur.close()
            conn.close()
        except Exception as e:
            pytest.fail(f"Falha na conexão com o banco de dados: {e}")
    
    def test_init_db(self, client):
        """Testa inicialização do banco de dados"""
        response = client.post('/api/init-db')
        
        assert response.status_code == 200
        assert response.json['status'] == 'success'

class TestErrorHandling:
    """Testes para tratamento de erros"""
    
    def test_404_error(self, client):
        """Testa rota inexistente"""
        response = client.get('/api/nonexistent')
        assert response.status_code == 404
    
    def test_invalid_json(self, client):
        """Testa requisição com JSON inválido"""
        response = client.post('/api/auth/login',
            data='invalid json',
            content_type='application/json'
        )
        
        assert response.status_code in [400, 500]
    
    def test_invalid_token(self, client):
        """Testa requisição com token inválido"""
        response = client.post('/api/proxy/verify',
            json={'hash': '0x' + '0' * 64},
            headers={'Authorization': 'Bearer invalid_token'}
        )
        
        assert response.status_code == 401

if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])

