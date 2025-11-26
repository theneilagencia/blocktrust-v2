"""
Cliente API para Monitoramento - Blocktrust v1.2
"""

import os
import requests
import logging

logger = logging.getLogger(__name__)

API_BASE = os.getenv("API_BASE", "http://localhost:10000")
JWT_MONITOR_EMAIL = os.getenv("JWT_MONITOR_EMAIL", "admin@bts.com")
JWT_MONITOR_PASS = os.getenv("JWT_MONITOR_PASS", "123")

def get_token():
    """
    Obtém token JWT para monitoramento
    
    Returns:
        str: Token JWT
    """
    try:
        response = requests.post(
            f"{API_BASE}/api/explorer/login",
            json={
                "email": JWT_MONITOR_EMAIL,
                "password": JWT_MONITOR_PASS
            },
            timeout=10
        )
        response.raise_for_status()
        token = response.json()["token"]
        logger.debug(f"✅ Token JWT obtido com sucesso")
        return token
    except Exception as e:
        logger.error(f"❌ Erro ao obter token JWT: {str(e)}")
        raise

def get(path, token):
    """
    Faz requisição GET com autenticação JWT
    
    Args:
        path: Caminho da API (ex: /api/explorer/events)
        token: Token JWT
    
    Returns:
        Response: Resposta da requisição
    """
    return requests.get(
        f"{API_BASE}{path}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )

def post(path, token, data):
    """
    Faz requisição POST com autenticação JWT
    
    Args:
        path: Caminho da API
        token: Token JWT
        data: Dados a serem enviados
    
    Returns:
        Response: Resposta da requisição
    """
    return requests.post(
        f"{API_BASE}{path}",
        headers={"Authorization": f"Bearer {token}"},
        json=data,
        timeout=10
    )

