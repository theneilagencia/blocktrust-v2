"""
Admin Routes - Superadmin Area
Protected endpoints for system administration, audit, and monitoring
"""

from flask import Blueprint, jsonify, request
from api.utils.db import get_db_connection
from api.utils.jwt_utils import (
    generate_access_token, 
    generate_refresh_token,
    jwt_required,
    blacklist_token,
    log_audit
)
import bcrypt
import os
from datetime import datetime

admin_bp = Blueprint('admin', __name__)


# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

@admin_bp.route('/login', methods=['POST'])
def admin_login():
    """
    Admin login endpoint
    POST /api/admin/login
    Body: { "email": "admin@bts.com", "password": "123" }
    """
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400
        
        # Get user from database
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id, email, password_hash, role 
            FROM users 
            WHERE email = %s
        """, (email,))
        
        user = cur.fetchone()
        cur.close()
        conn.close()
        
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Verify password
        if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Check if user is admin or superadmin
        if user['role'] not in ['admin', 'superadmin']:
            return jsonify({'error': 'Access denied. Admin privileges required.'}), 403
        
        # Generate tokens
        access_token = generate_access_token(user['id'], user['email'], user['role'])
        refresh_token = generate_refresh_token(user['id'], user['email'], user['role'])
        
        # Log audit
        log_audit(
            user_id=user['id'],
            role=user['role'],
            action='admin_login',
            endpoint='/api/admin/login',
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        return jsonify({
            'status': 'success',
            'user': {
                'id': str(user['id']),
                'email': user['email'],
                'name': user['email'].split('@')[0],  # Use email prefix as name
                'role': user['role']
            },
            'access_token': access_token,
            'refresh_token': refresh_token
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/logout', methods=['POST'])
@jwt_required()
def admin_logout():
    """
    Admin logout endpoint (blacklist token)
    POST /api/admin/logout
    Headers: Authorization: Bearer <token>
    """
    try:
        # Get token from header
        auth_header = request.headers.get('Authorization')
        token = auth_header.split(' ')[1]
        
        # Decode to get JTI and expiration
        import jwt
        payload = jwt.decode(token, os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production'), algorithms=['HS256'])
        
        # Blacklist token
        blacklist_token(
            jti=payload['jti'],
            token_type=payload['type'],
            user_id=payload['user_id'],
            expires_at=datetime.fromtimestamp(payload['exp'])
        )
        
        # Log audit
        log_audit(
            user_id=request.current_user['user_id'],
            role=request.current_user['role'],
            action='admin_logout',
            endpoint='/api/admin/logout',
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        return jsonify({'status': 'success', 'message': 'Logged out successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# AUDIT ENDPOINTS (Superadmin only)
# ============================================================================

@admin_bp.route('/audit', methods=['GET'])
@jwt_required(allowed_roles=['superadmin'])
def get_audit_logs():
    """
    Get audit logs
    GET /api/admin/audit?limit=50&offset=0&action=admin_login
    """
    try:
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        action = request.args.get('action', None)
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Build query
        query = """
            SELECT 
                a.id, a.user_id, a.role, a.action, a.endpoint,
                a.ip_address, a.user_agent, a.request_data,
                a.response_status, a.created_at,
                u.email, u.name
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
        """
        
        params = []
        if action:
            query += " WHERE a.action = %s"
            params.append(action)
        
        query += " ORDER BY a.created_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        cur.execute(query, params)
        logs = cur.fetchall()
        
        # Get total count
        count_query = "SELECT COUNT(*) as total FROM audit_logs"
        if action:
            count_query += " WHERE action = %s"
            cur.execute(count_query, [action])
        else:
            cur.execute(count_query)
        
        total = cur.fetchone()['total']
        
        cur.close()
        conn.close()
        
        # Log this audit request
        log_audit(
            user_id=request.current_user['user_id'],
            role=request.current_user['role'],
            action='view_audit_logs',
            endpoint='/api/admin/audit',
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        return jsonify({
            'status': 'success',
            'total': total,
            'limit': limit,
            'offset': offset,
            'logs': [dict(log) for log in logs]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# USER MANAGEMENT ENDPOINTS (Superadmin only)
# ============================================================================

@admin_bp.route('/users', methods=['GET'])
@jwt_required(allowed_roles=['superadmin'])
def get_users():
    """
    Get all users
    GET /api/admin/users?limit=50&offset=0
    """
    try:
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT 
                id, email, name, role, kyc_status, liveness_status,
                created_at, kyc_updated_at
            FROM users
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """, (limit, offset))
        
        users = cur.fetchall()
        
        # Get total count
        cur.execute("SELECT COUNT(*) as total FROM users")
        total = cur.fetchone()['total']
        
        cur.close()
        conn.close()
        
        # Log audit
        log_audit(
            user_id=request.current_user['user_id'],
            role=request.current_user['role'],
            action='view_users',
            endpoint='/api/admin/users',
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        return jsonify({
            'status': 'success',
            'total': total,
            'limit': limit,
            'offset': offset,
            'users': [dict(user) for user in users]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# SYSTEM HEALTH ENDPOINTS (Superadmin only)
# ============================================================================

@admin_bp.route('/health', methods=['GET'])
@jwt_required(allowed_roles=['superadmin'])
def get_system_health():
    """
    Get system health status
    GET /api/admin/health
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Database health
        cur.execute("SELECT version()")
        db_version = cur.fetchone()['version']
        
        # User statistics
        cur.execute("SELECT COUNT(*) as total FROM users")
        total_users = cur.fetchone()['total']
        
        cur.execute("SELECT COUNT(*) as total FROM users WHERE kyc_status = 'approved'")
        approved_kyc = cur.fetchone()['total']
        
        # Recent activity (last 24h)
        cur.execute("""
            SELECT COUNT(*) as total FROM audit_logs 
            WHERE created_at > NOW() - INTERVAL '24 hours'
        """)
        activity_24h = cur.fetchone()['total']
        
        cur.close()
        conn.close()
        
        # Log audit
        log_audit(
            user_id=request.current_user['user_id'],
            role=request.current_user['role'],
            action='view_health',
            endpoint='/api/admin/health',
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        return jsonify({
            'status': 'success',
            'health': {
                'database': {
                    'status': 'healthy',
                    'version': db_version
                },
                'statistics': {
                    'total_users': total_users,
                    'approved_kyc': approved_kyc,
                    'activity_24h': activity_24h
                },
                'timestamp': datetime.utcnow().isoformat()
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# MIGRATION ENDPOINTS (Legacy - kept for compatibility)
# ============================================================================

@admin_bp.route('/setup-audit-logs', methods=['POST'])
def setup_audit_logs():
    """Create audit_logs table (development only)"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Create audit_logs table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                email VARCHAR(255),
                action VARCHAR(255) NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                details JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create indexes
        cur.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)")
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'audit_logs table created successfully'
        }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/promote-admin/<email>', methods=['POST'])
def promote_admin(email):
    """Promote user to superadmin (development only)"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute(
            "UPDATE users SET role = %s WHERE email = %s RETURNING id, email, role",
            ('superadmin', email)
        )
        
        user = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        if user:
            return jsonify({
                'status': 'success',
                'message': f'User {email} promoted to superadmin',
                'user': dict(user)
            }), 200
        else:
            return jsonify({'error': 'User not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/create-admin', methods=['POST'])
def create_admin():
    """Create or update superadmin user (development only)"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check if admin already exists
        cur.execute("SELECT id FROM users WHERE email = %s", ('admin@bts.com',))
        existing = cur.fetchone()
        
        if existing:
            # Update existing user to superadmin
            password_hash = bcrypt.hashpw('123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cur.execute(
                "UPDATE users SET password_hash = %s, role = %s WHERE email = %s",
                (password_hash, 'superadmin', 'admin@bts.com')
            )
            conn.commit()
            cur.close()
            conn.close()
            return jsonify({'status': 'success', 'message': 'Admin user updated'}), 200
        else:
            # Create new admin user
            password_hash = bcrypt.hashpw('123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cur.execute(
                "INSERT INTO users (email, password_hash, role) VALUES (%s, %s, %s) RETURNING id",
                ('admin@bts.com', password_hash, 'superadmin')
            )
            conn.commit()
            cur.close()
            conn.close()
            return jsonify({'status': 'success', 'message': 'Admin user created'}), 201
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/migrate', methods=['POST'])
@jwt_required(allowed_roles=['superadmin'])
def run_migration():
    """
    Run database migration
    POST /api/admin/migrate
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Read migration file
        migration_path = os.path.join(os.path.dirname(__file__), '../../migrations/001_add_admin_features.sql')
        
        with open(migration_path, 'r') as f:
            migration_sql = f.read()
        
        # Execute migration
        cur.execute(migration_sql)
        conn.commit()
        
        cur.close()
        conn.close()
        
        # Log audit
        log_audit(
            user_id=request.current_user['user_id'],
            role=request.current_user['role'],
            action='run_migration',
            endpoint='/api/admin/migrate',
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        return jsonify({
            'status': 'success',
            'message': 'Migration executed successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/debug-env', methods=['GET'])
@jwt_required(allowed_roles=['superadmin'])
def debug_env():
    """Retorna variáveis de ambiente para debug (Superadmin only)"""
    
    # Log audit
    log_audit(
        user_id=request.current_user['user_id'],
        role=request.current_user['role'],
        action='view_debug_env',
        endpoint='/api/admin/debug-env',
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )
    
    return jsonify({
        'toolblox': {
            'mint_url': os.getenv('TOOLBLOX_MINT_IDENTITY_URL'),
            'signature_url': os.getenv('TOOLBLOX_REGISTER_SIGNATURE_URL'),
            'verify_url': os.getenv('TOOLBLOX_VERIFY_URL'),
            'network': os.getenv('TOOLBLOX_NETWORK')
        },
        'sumsub': {
            'app_token_set': bool(os.getenv('SUMSUB_APP_TOKEN')),
            'secret_key_set': bool(os.getenv('SUMSUB_SECRET_KEY')),
            'level_name': os.getenv('SUMSUB_LEVEL_NAME')
        },
        'smtp': {
            'host': os.getenv('SMTP_HOST'),
            'port': os.getenv('SMTP_PORT'),
            'user': os.getenv('SMTP_USER'),
            'from': os.getenv('SMTP_FROM'),
            'pass_set': bool(os.getenv('SMTP_PASS'))
        }
    }), 200

