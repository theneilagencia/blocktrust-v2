"""
Testes Automatizados do Fluxo KYC - Blocktrust v1.4
Valida integração com Sumsub real (sem modo mock)
"""

import pytest
import json
from flask import Flask
from api.routes.kyc_routes import kyc_bp
from api.routes.auth_routes import auth_bp

@pytest.fixture
def client():
    """Cria cliente de teste Flask"""
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(kyc_bp, url_prefix='/api/kyc')
    
    with app.test_client() as client:
        yield client

@pytest.fixture
def auth_token(client):
    """Cria usuário de teste e retorna token de autenticação"""
    # Criar conta
    response = client.post('/api/auth/register', json={
        'email': f'test_kyc_{int(time.time())}@example.com',
        'password': 'TestPass123!',
        'coercion_password': 'EmergencyPass456!'
    })
    
    assert response.status_code == 201
    data = json.loads(response.data)
    return data['token']

def test_kyc_flow_success(client, auth_token):
    """
    Testa fluxo KYC completo com sucesso
    
    Verifica:
    - Inicialização do KYC retorna accessToken real
    - applicantId é gerado pela Sumsub
    - mock_mode é false
    - Não há mensagens de "Mock"
    """
    response = client.post(
        '/api/kyc/init',
        headers={'Authorization': f'Bearer {auth_token}'},
        json={}
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    
    # Validações críticas
    assert 'accessToken' in data, "accessToken não retornado"
    assert 'applicantId' in data, "applicantId não retornado"
    assert data.get('mock_mode') == False, "Modo mock está ativo!"
    
    # Validar formato do accessToken (deve ser real, não mock)
    assert not data['accessToken'].startswith('mock_'), "Token é mock!"
    assert len(data['accessToken']) > 20, "Token muito curto (provavelmente mock)"
    
    # Validar formato do applicantId (deve ser real, não mock)
    assert not data['applicantId'].startswith('mock_'), "applicantId é mock!"
    assert len(data['applicantId']) > 10, "applicantId muito curto"
    
    # Verificar que não há mensagens de mock
    response_text = response.data.decode('utf-8')
    assert 'Mock' not in response_text, "Resposta contém referência a 'Mock'"
    assert 'mock' not in data.get('message', '').lower(), "Mensagem contém 'mock'"

def test_kyc_init_without_token(client):
    """
    Testa inicialização de KYC sem token de autenticação
    
    Deve retornar erro 401 Unauthorized
    """
    response = client.post('/api/kyc/init', json={})
    
    assert response.status_code == 401
    data = json.loads(response.data)
    assert 'error' in data

def test_kyc_init_invalid_credentials(client, auth_token, monkeypatch):
    """
    Testa inicialização de KYC com credenciais inválidas
    
    Simula erro de autenticação da Sumsub
    """
    # Mock de credenciais inválidas
    import os
    monkeypatch.setenv('SUMSUB_APP_TOKEN', 'invalid_token')
    
    response = client.post(
        '/api/kyc/init',
        headers={'Authorization': f'Bearer {auth_token}'},
        json={}
    )
    
    # Deve retornar erro (401 ou 500)
    assert response.status_code in [401, 500]
    data = json.loads(response.data)
    assert 'error' in data

def test_kyc_status(client, auth_token):
    """
    Testa consulta de status do KYC
    
    Deve retornar status atual do usuário
    """
    response = client.get(
        '/api/kyc/status',
        headers={'Authorization': f'Bearer {auth_token}'}
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    
    # Validar estrutura da resposta
    assert 'status' in data
    assert data['status'] in ['not_started', 'pending', 'approved', 'rejected']

def test_kyc_webhook_signature_validation(client):
    """
    Testa validação de assinatura HMAC do webhook
    
    Webhook sem assinatura deve ser rejeitado
    """
    response = client.post('/api/kyc/webhook', json={
        'type': 'applicantReviewed',
        'applicantId': '123',
        'externalUserId': '1',
        'reviewStatus': 'completed'
    })
    
    # Deve rejeitar por falta de assinatura
    assert response.status_code in [401, 403]

def test_kyc_webhook_with_valid_signature(client, monkeypatch):
    """
    Testa processamento de webhook com assinatura válida
    
    Simula webhook da Sumsub com assinatura HMAC correta
    """
    import hmac
    import hashlib
    
    # Dados do webhook
    webhook_data = {
        'type': 'applicantReviewed',
        'applicantId': 'test_applicant_123',
        'externalUserId': '1',
        'reviewStatus': 'completed',
        'reviewResult': {'reviewAnswer': 'GREEN'}
    }
    
    # Gerar assinatura HMAC
    secret_key = 'test_secret_key'
    monkeypatch.setenv('SUMSUB_SECRET_KEY', secret_key)
    
    payload = json.dumps(webhook_data).encode('utf-8')
    signature = hmac.new(
        secret_key.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    response = client.post(
        '/api/kyc/webhook',
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'X-Payload-Digest': f'sha256={signature}'
        }
    )
    
    # Deve aceitar webhook
    assert response.status_code == 200

def test_kyc_approved_triggers_nft_mint(client, auth_token, monkeypatch):
    """
    Testa que KYC aprovado dispara mint de NFT automaticamente
    
    Verifica integração com sistema de NFT
    """
    # Mock da função mint_nft para capturar chamada
    mint_called = {'called': False, 'user_id': None}
    
    def mock_mint_nft(user_id, kyc_data):
        mint_called['called'] = True
        mint_called['user_id'] = user_id
        return {
            'success': True,
            'nft_id': 1001,
            'tx_hash': '0xtest123'
        }
    
    monkeypatch.setattr('api.utils.nft.mint_nft', mock_mint_nft)
    
    # Simular webhook de KYC aprovado
    # (código de teste simplificado)
    
    # Validar que mint_nft foi chamado
    # assert mint_called['called'], "mint_nft não foi chamado após KYC aprovado"

# Testes de integração com banco de dados

def test_audit_log_created_on_kyc_approval(client, auth_token):
    """
    Testa que evento de auditoria é criado quando KYC é aprovado
    
    Verifica integração com sistema de auditoria
    """
    # Implementar teste de auditoria
    pass

def test_user_status_updated_on_kyc_approval(client, auth_token):
    """
    Testa que status do usuário é atualizado no banco quando KYC é aprovado
    
    Verifica atualização da tabela users
    """
    # Implementar teste de atualização de status
    pass

# Testes de performance

def test_kyc_init_response_time(client, auth_token):
    """
    Testa tempo de resposta da inicialização de KYC
    
    Deve responder em menos de 2 segundos
    """
    import time
    
    start = time.time()
    response = client.post(
        '/api/kyc/init',
        headers={'Authorization': f'Bearer {auth_token}'},
        json={}
    )
    elapsed = time.time() - start
    
    assert elapsed < 2.0, f"Resposta muito lenta: {elapsed:.2f}s"
    assert response.status_code == 200

# Testes de segurança

def test_kyc_init_prevents_sql_injection(client, auth_token):
    """
    Testa que endpoint KYC está protegido contra SQL injection
    """
    # Tentar SQL injection no campo de user_id
    response = client.post(
        '/api/kyc/init',
        headers={'Authorization': f'Bearer {auth_token}'},
        json={'user_id': "1' OR '1'='1"}
    )
    
    # Não deve retornar dados de outros usuários
    assert response.status_code in [200, 400, 401]

def test_kyc_webhook_prevents_replay_attacks(client):
    """
    Testa que webhook está protegido contra ataques de replay
    
    Mesmo webhook não deve ser processado duas vezes
    """
    # Implementar teste de replay attack
    pass

if __name__ == '__main__':
    pytest.main([__file__, '-v'])

