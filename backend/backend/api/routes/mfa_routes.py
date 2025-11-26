"""
MFA (Multi-Factor Authentication) Routes

Endpoints for TOTP-based 2FA management:
- Setup MFA (generate secret, QR code)
- Verify MFA tokens
- Disable MFA
- Regenerate backup codes
- Get MFA status
"""

from flask import Blueprint, request, jsonify
from api.services.mfa_service import MFAService
from api.auth import token_required


mfa_bp = Blueprint('mfa', __name__)


@mfa_bp.route('/setup', methods=['POST'])
@token_required
def setup_mfa(current_user):
    """
    Step 1: Generate MFA secret and QR code for setup
    POST /api/mfa/setup
    """
    try:
        # Check if MFA is already enabled
        mfa_info = MFAService.get_user_mfa_info(current_user.id)
        if mfa_info and mfa_info.get('mfa_enabled'):
            return jsonify({
                'success': False,
                'error': 'MFA is already enabled'
            }), 400
        
        # Generate secret and QR code
        secret = MFAService.generate_secret()
        qr_code = MFAService.generate_qr_code(current_user.email, secret)
        backup_codes = MFAService.generate_backup_codes()
        
        return jsonify({
            'success': True,
            'secret': secret,
            'qr_code': qr_code,
            'backup_codes': backup_codes,
            'message': 'Scan QR code with your authenticator app'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Setup failed: {str(e)}'
        }), 500


@mfa_bp.route('/verify-setup', methods=['POST'])
@token_required
def verify_setup(current_user):
    """
    Step 2: Verify TOTP token and complete MFA setup
    POST /api/mfa/verify-setup
    Body: { "secret": "...", "token": "123456", "backup_codes": [...] }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        secret = data.get('secret')
        token = data.get('token')
        backup_codes = data.get('backup_codes')
        
        if not secret or not token or not backup_codes:
            return jsonify({
                'success': False,
                'error': 'Missing required fields: secret, token, backup_codes'
            }), 400
        
        # Verify the token
        if not MFAService.verify_totp(secret, token):
            return jsonify({
                'success': False,
                'error': 'Invalid verification code'
            }), 400
        
        # Setup MFA
        if MFAService.setup_mfa(current_user.id, secret, backup_codes):
            return jsonify({
                'success': True,
                'message': 'MFA enabled successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to enable MFA'
            }), 500
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Verification failed: {str(e)}'
        }), 500


@mfa_bp.route('/verify', methods=['POST'])
@token_required
def verify_mfa(current_user):
    """
    Verify MFA token (for login or sensitive operations)
    POST /api/mfa/verify
    Body: { "token": "123456" }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        token = data.get('token')
        if not token:
            return jsonify({
                'success': False,
                'error': 'Token is required'
            }), 400
        
        success, method = MFAService.verify_user_mfa(current_user.id, token)
        
        if success:
            return jsonify({
                'success': True,
                'method': method,
                'message': 'MFA verification successful'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Invalid MFA token',
                'reason': method
            }), 400
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Verification failed: {str(e)}'
        }), 500


@mfa_bp.route('/disable', methods=['POST'])
@token_required
def disable_mfa(current_user):
    """
    Disable MFA for the user
    POST /api/mfa/disable
    Body: { "token": "123456", "password": "..." }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        token = data.get('token')
        password = data.get('password')
        
        if not token or not password:
            return jsonify({
                'success': False,
                'error': 'MFA token and password are required'
            }), 400
        
        # Verify password (you'll need to implement this)
        # For now, assuming password verification exists
        import bcrypt
        if not bcrypt.checkpw(password.encode('utf-8'),
                              current_user.password_hash.encode('utf-8')):
            return jsonify({
                'success': False,
                'error': 'Invalid password'
            }), 400
        
        # Verify MFA token
        success, method = MFAService.verify_user_mfa(current_user.id, token)
        if not success:
            return jsonify({
                'success': False,
                'error': 'Invalid MFA token'
            }), 400
        
        # Disable MFA
        if MFAService.disable_mfa(current_user.id):
            return jsonify({
                'success': True,
                'message': 'MFA disabled successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to disable MFA'
            }), 500
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Disable failed: {str(e)}'
        }), 500


@mfa_bp.route('/status', methods=['GET'])
@token_required
def mfa_status(current_user):
    """
    Get user's MFA status
    GET /api/mfa/status
    """
    try:
        mfa_info = MFAService.get_user_mfa_info(current_user.id)
        
        if mfa_info is None:
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404
        
        return jsonify({
            'success': True,
            'mfa_enabled': mfa_info['mfa_enabled'],
            'backup_codes_count': mfa_info['backup_codes_count']
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Status check failed: {str(e)}'
        }), 500


@mfa_bp.route('/backup-codes/regenerate', methods=['POST'])
@token_required
def regenerate_backup_codes(current_user):
    """
    Generate new backup codes
    POST /api/mfa/backup-codes/regenerate
    Body: { "token": "123456" }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        token = data.get('token')
        if not token:
            return jsonify({
                'success': False,
                'error': 'MFA token is required'
            }), 400
        
        # Verify MFA token first
        success, method = MFAService.verify_user_mfa(current_user.id, token)
        if not success:
            return jsonify({
                'success': False,
                'error': 'Invalid MFA token'
            }), 400
        
        # Generate new backup codes
        new_codes = MFAService.regenerate_backup_codes(current_user.id)
        
        if new_codes:
            return jsonify({
                'success': True,
                'backup_codes': new_codes,
                'message': 'New backup codes generated'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to regenerate backup codes'
            }), 500
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Regeneration failed: {str(e)}'
        }), 500
