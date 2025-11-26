"""
JWT Utilities for Admin Authentication
Handles token generation, validation, and blacklisting
"""

import jwt
import os
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify
from api.utils.db import get_db_connection
import uuid

# JWT Configuration
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=30)
JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)


def generate_access_token(user_id, email, role):
    """Generate JWT access token"""
    payload = {
        'user_id': str(user_id),
        'email': email,
        'role': role,
        'type': 'access',
        'jti': str(uuid.uuid4()),  # JWT ID for blacklisting
        'exp': datetime.utcnow() + JWT_ACCESS_TOKEN_EXPIRES,
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def generate_refresh_token(user_id, email, role):
    """Generate JWT refresh token"""
    payload = {
        'user_id': str(user_id),
        'email': email,
        'role': role,
        'type': 'refresh',
        'jti': str(uuid.uuid4()),
        'exp': datetime.utcnow() + JWT_REFRESH_TOKEN_EXPIRES,
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token):
    """Decode and validate JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        
        # Check if token is blacklisted
        if is_token_blacklisted(payload.get('jti')):
            return None
        
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def is_token_blacklisted(jti):
    """Check if token JTI is in blacklist"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT 1 FROM jwt_blacklist 
            WHERE jti = %s AND expires_at > NOW()
        """, (jti,))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        return result is not None
    except Exception as e:
        print(f"Error checking blacklist: {e}")
        return False


def blacklist_token(jti, token_type, user_id, expires_at):
    """Add token to blacklist"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO jwt_blacklist (jti, token_type, user_id, expires_at)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (jti) DO NOTHING
        """, (jti, token_type, user_id, expires_at))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return True
    except Exception as e:
        print(f"Error blacklisting token: {e}")
        return False


def jwt_required(allowed_roles=None):
    """
    Decorator to protect routes with JWT authentication
    
    Args:
        allowed_roles (list): List of allowed roles (e.g., ['admin', 'superadmin'])
                             If None, any authenticated user can access
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get token from Authorization header
            auth_header = request.headers.get('Authorization')
            
            if not auth_header:
                return jsonify({'error': 'No authorization header'}), 401
            
            try:
                # Extract token (format: "Bearer <token>")
                token = auth_header.split(' ')[1]
            except IndexError:
                return jsonify({'error': 'Invalid authorization header format'}), 401
            
            # Decode token
            payload = decode_token(token)
            
            if not payload:
                return jsonify({'error': 'Invalid or expired token'}), 401
            
            # Check role if specified
            if allowed_roles:
                user_role = payload.get('role')
                if user_role not in allowed_roles:
                    return jsonify({'error': 'Insufficient permissions'}), 403
            
            # Add user info to request context
            request.current_user = {
                'user_id': payload.get('user_id'),
                'email': payload.get('email'),
                'role': payload.get('role')
            }
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


def log_audit(user_id, role, action, endpoint, ip_address, user_agent, request_data=None, response_status=None):
    """Log admin action to audit_logs table"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO audit_logs 
            (user_id, role, action, endpoint, ip_address, user_agent, request_data, response_status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (user_id, role, action, endpoint, ip_address, user_agent, request_data, response_status))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return True
    except Exception as e:
        print(f"Error logging audit: {e}")
        return False

