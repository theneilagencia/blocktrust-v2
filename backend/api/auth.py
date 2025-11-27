import jwt
import os
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify
from api.models import User
from api.utils.db import get_db_connection

SECRET_KEY = os.getenv('JWT_SECRET', 'dev-secret-key')


def generate_token(user_id, email, role='user', mfa_verified=False):
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'mfa_verified': mfa_verified,
        'exp': datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')


def decode_token(token):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_user_from_token(payload):
    """Get User object from token payload"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, email, password_hash, role, created_at,
                       mfa_enabled, mfa_secret, backup_codes
                FROM users WHERE id = %s
            """, (payload['user_id'],))
            
            result = cursor.fetchone()
            if not result:
                return None
            
            # RealDictCursor returns dictionaries, so access by column name
            return User(
                id=result['id'],
                email=result['email'],
                password_hash=result['password_hash'],
                role=result['role'],
                created_at=result['created_at'],
                mfa_enabled=result['mfa_enabled'],
                mfa_secret=result['mfa_secret'],
                backup_codes=result['backup_codes']
            )
    except Exception as e:
        import logging
        logging.error(f"Error getting user from token: {str(e)}")
        return None


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401
        
        payload = decode_token(token)
        if not payload:
            return jsonify({'error': 'Token inválido ou expirado'}), 401
        
        # Get user object
        current_user = get_user_from_token(payload)
        if not current_user:
            return jsonify({'error': 'Usuário não encontrado'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated


def mfa_required(f):
    """Decorator that requires MFA verification"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401
        
        payload = decode_token(token)
        if not payload:
            return jsonify({'error': 'Token inválido ou expirado'}), 401
        
        # Get user object
        current_user = get_user_from_token(payload)
        if not current_user:
            return jsonify({'error': 'Usuário não encontrado'}), 401
        
        # Check if MFA is enabled and verified
        if current_user.mfa_enabled and not payload.get('mfa_verified'):
            return jsonify({
                'error': 'MFA verification required',
                'mfa_required': True
            }), 403
        
        return f(current_user, *args, **kwargs)
    
    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401
        
        payload = decode_token(token)
        if not payload:
            return jsonify({'error': 'Token inválido ou expirado'}), 401
        
        # Get user object
        current_user = get_user_from_token(payload)
        if not current_user:
            return jsonify({'error': 'Usuário não encontrado'}), 401
        
        if current_user.role != 'admin':
            return jsonify({
                'error': 'Acesso negado: privilégios de admin necessários'
            }), 403
        
        # Check if MFA is enabled and verified for admin operations
        if current_user.mfa_enabled and not payload.get('mfa_verified'):
            return jsonify({
                'error': 'MFA verification required for admin operations',
                'mfa_required': True
            }), 403
        
        return f(current_user, *args, **kwargs)
    
    return decorated

