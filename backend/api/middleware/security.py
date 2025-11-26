"""
Middleware de Segurança - Blocktrust v1.4
Rate limiting e auditoria
"""

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from functools import wraps
from flask import request
import logging

logger = logging.getLogger(__name__)

# Inicializar rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

def rate_limit_pgp_import(f):
    """
    Rate limit para importação de chaves PGP
    Limite: 5 por hora
    """
    @wraps(f)
    @limiter.limit("5 per hour")
    def decorated(*args, **kwargs):
        return f(*args, **kwargs)
    return decorated

def rate_limit_dual_sign(f):
    """
    Rate limit para assinatura dupla
    Limite: 20 por hora
    """
    @wraps(f)
    @limiter.limit("20 per hour")
    def decorated(*args, **kwargs):
        return f(*args, **kwargs)
    return decorated

def audit_log(action: str):
    """
    Decorator para auditoria de ações sensíveis
    
    Args:
        action: Nome da ação (ex: "pgp_import", "dual_sign")
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            # Log antes da ação
            logger.info(f"🔍 AUDIT: {action} | User: {getattr(request, 'user_id', 'unknown')} | IP: {request.remote_addr} | UA: {request.headers.get('User-Agent', '')[:100]}")
            
            # Executar função
            result = f(*args, **kwargs)
            
            # Log após a ação (apenas se sucesso)
            if isinstance(result, tuple) and result[1] == 200:
                logger.info(f"✅ AUDIT: {action} | Success")
            elif isinstance(result, tuple):
                logger.warning(f"⚠️ AUDIT: {action} | Failed with status {result[1]}")
            
            return result
        return decorated
    return decorator

def validate_input(required_fields: list):
    """
    Decorator para validação de input
    
    Args:
        required_fields: Lista de campos obrigatórios
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            data = request.get_json()
            
            if not data:
                return {'error': 'Body JSON não fornecido'}, 400
            
            missing_fields = [field for field in required_fields if field not in data or not data[field]]
            
            if missing_fields:
                return {'error': f'Campos obrigatórios faltando: {", ".join(missing_fields)}'}, 400
            
            return f(*args, **kwargs)
        return decorated
    return decorator

