"""
Testes de Integração - Assinatura Dupla v1.4
"""

import pytest
import json
import hashlib
from api.utils.pgp import import_public_key, calculate_pgp_sig_hash, fingerprint_to_bytes20

# Mock de chave PGP para testes
MOCK_PUBLIC_KEY = """-----BEGIN PGP PUBLIC KEY BLOCK-----

mQENBGXxYZ0BCADExamplePublicKeyDataHere123456789ABCDEF
ThisIsAMockKeyForTestingPurposesOnly
-----END PGP PUBLIC KEY BLOCK-----"""

MOCK_FINGERPRINT = "ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234"

MOCK_SIGNATURE = """-----BEGIN PGP SIGNATURE-----

iQEzBAABCAAdFiEExampleSignatureDataHere123456789ABCDEF
ThisIsAMockSignatureForTestingPurposesOnly
-----END PGP SIGNATURE-----"""

class TestPGPUtils:
    """Testes dos utilitários PGP"""
    
    def test_calculate_pgp_sig_hash(self):
        """Testa cálculo de hash de assinatura PGP"""
        sig_hash = calculate_pgp_sig_hash(MOCK_SIGNATURE)
        
        assert sig_hash.startswith('0x')
        assert len(sig_hash) == 66  # 0x + 64 caracteres hex
    
    def test_fingerprint_to_bytes20(self):
        """Testa conversão de fingerprint para bytes20"""
        fp_bytes = fingerprint_to_bytes20(MOCK_FINGERPRINT)
        
        assert fp_bytes.startswith('0x')
        assert len(fp_bytes) == 42  # 0x + 40 caracteres hex
    
    def test_fingerprint_to_bytes20_short(self):
        """Testa conversão de fingerprint curto (deve falhar)"""
        with pytest.raises(ValueError):
            fingerprint_to_bytes20("SHORT")

class TestPGPRoutes:
    """Testes das rotas PGP"""
    
    @pytest.fixture
    def client(self):
        """Fixture do cliente Flask"""
        from app import app
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client
    
    @pytest.fixture
    def auth_token(self, client):
        """Fixture de token de autenticação"""
        # Registrar usuário de teste
        client.post('/api/auth/register', json={
            'email': 'test_pgp@example.com',
            'password': 'Test123!',
            'name': 'Test PGP User'
        })
        
        # Login
        response = client.post('/api/auth/login', json={
            'email': 'test_pgp@example.com',
            'password': 'Test123!'
        })
        
        data = json.loads(response.data)
        return data['token']
    
    def test_import_pgp_key_no_auth(self, client):
        """Testa importação de chave sem autenticação"""
        response = client.post('/api/pgp/import', json={
            'armored_pubkey': MOCK_PUBLIC_KEY
        })
        
        assert response.status_code == 401
    
    def test_import_pgp_key_missing_data(self, client, auth_token):
        """Testa importação de chave sem dados"""
        response = client.post(
            '/api/pgp/import',
            json={},
            headers={'Authorization': f'Bearer {auth_token}'}
        )
        
        assert response.status_code == 400
    
    def test_get_pgp_key_not_found(self, client, auth_token):
        """Testa obter chave PGP não existente"""
        response = client.get(
            '/api/pgp/key',
            headers={'Authorization': f'Bearer {auth_token}'}
        )
        
        assert response.status_code == 404

class TestDualSignatureRoutes:
    """Testes das rotas de assinatura dupla"""
    
    @pytest.fixture
    def client(self):
        """Fixture do cliente Flask"""
        from app import app
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client
    
    @pytest.fixture
    def auth_token(self, client):
        """Fixture de token de autenticação"""
        # Registrar usuário de teste
        client.post('/api/auth/register', json={
            'email': 'test_dual@example.com',
            'password': 'Test123!',
            'name': 'Test Dual User'
        })
        
        # Login
        response = client.post('/api/auth/login', json={
            'email': 'test_dual@example.com',
            'password': 'Test123!'
        })
        
        data = json.loads(response.data)
        return data['token']
    
    def test_sign_dual_no_auth(self, client):
        """Testa assinatura dupla sem autenticação"""
        response = client.post('/api/dual/sign', json={
            'doc_hash': '0x1234',
            'pgp_signature': MOCK_SIGNATURE,
            'pgp_fingerprint': MOCK_FINGERPRINT,
            'nft_id': 1
        })
        
        assert response.status_code == 401
    
    def test_sign_dual_missing_fields(self, client, auth_token):
        """Testa assinatura dupla com campos faltando"""
        response = client.post(
            '/api/dual/sign',
            json={'doc_hash': '0x1234'},
            headers={'Authorization': f'Bearer {auth_token}'}
        )
        
        assert response.status_code == 400
    
    def test_sign_dual_no_pgp_key(self, client, auth_token):
        """Testa assinatura dupla sem chave PGP importada"""
        response = client.post(
            '/api/dual/sign',
            json={
                'doc_hash': '0x1234567890abcdef',
                'pgp_signature': MOCK_SIGNATURE,
                'pgp_fingerprint': MOCK_FINGERPRINT,
                'nft_id': 1
            },
            headers={'Authorization': f'Bearer {auth_token}'}
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'não possui chave PGP' in data['error']
    
    def test_verify_dual_no_auth(self, client):
        """Testa verificação de assinatura dupla sem autenticação"""
        response = client.post('/api/dual/verify', json={
            'doc_hash': '0x1234',
            'pgp_signature': MOCK_SIGNATURE,
            'pgp_fingerprint': MOCK_FINGERPRINT
        })
        
        assert response.status_code == 401
    
    def test_verify_dual_missing_fields(self, client, auth_token):
        """Testa verificação com campos faltando"""
        response = client.post(
            '/api/dual/verify',
            json={'doc_hash': '0x1234'},
            headers={'Authorization': f'Bearer {auth_token}'}
        )
        
        assert response.status_code == 400

class TestExplorerDualProofs:
    """Testes do endpoint de dual proofs no explorer"""
    
    @pytest.fixture
    def client(self):
        """Fixture do cliente Flask"""
        from app import app
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client
    
    def test_get_dual_proofs(self, client):
        """Testa obter lista de dual proofs"""
        response = client.get('/api/explorer/dual-proofs')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'proofs' in data
        assert 'total' in data
        assert isinstance(data['proofs'], list)
    
    def test_get_dual_proofs_pagination(self, client):
        """Testa paginação de dual proofs"""
        response = client.get('/api/explorer/dual-proofs?page=1&per_page=10')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['page'] == 1
        assert data['per_page'] == 10

if __name__ == '__main__':
    pytest.main([__file__, '-v'])

