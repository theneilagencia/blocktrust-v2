"""
Multi-Factor Authentication (MFA) Service using TOTP

This service provides:
- TOTP secret generation and QR code creation
- TOTP verification
- Backup code generation and management
- MFA setup and disable functionality

Compatible with Google Authenticator, Authy, and other TOTP apps.
"""

import pyotp
import qrcode
import io
import base64
import json
import secrets
import bcrypt
from typing import List, Dict, Optional, Tuple
from api.utils.db import get_db_connection


class MFAService:
    """Multi-Factor Authentication service using TOTP"""
    
    @staticmethod
    def generate_secret() -> str:
        """Generate a new TOTP secret key"""
        return pyotp.random_base32()
    
    @staticmethod
    def generate_qr_code(email: str, secret: str,
                         issuer: str = "Blocktrust") -> str:
        """
        Generate QR code for TOTP setup
        Returns base64 encoded PNG image
        """
        totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=email,
            issuer_name=issuer
        )
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(totp_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        img_buffer = io.BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        return base64.b64encode(img_buffer.read()).decode()
    
    @staticmethod
    def verify_totp(secret: str, token: str, window: int = 1) -> bool:
        """
        Verify TOTP token
        window: number of 30-second windows to check (for clock drift)
        """
        if not secret or not token:
            return False
            
        try:
            totp = pyotp.TOTP(secret)
            return totp.verify(token, valid_window=window)
        except Exception:
            return False
    
    @staticmethod
    def generate_backup_codes(count: int = 8) -> List[str]:
        """Generate backup codes for MFA recovery"""
        codes = []
        for _ in range(count):
            # Generate 8-digit backup code
            code = ''.join([str(secrets.randbelow(10)) for _ in range(8)])
            # Format as XXXX-XXXX
            formatted_code = f"{code[:4]}-{code[4:]}"
            codes.append(formatted_code)
        return codes
    
    @staticmethod
    def hash_backup_codes(codes: List[str]) -> List[str]:
        """Hash backup codes for secure storage"""
        hashed_codes = []
        for code in codes:
            # Remove formatting for hashing
            clean_code = code.replace('-', '')
            hashed = bcrypt.hashpw(
                clean_code.encode('utf-8'),
                bcrypt.gensalt()
            ).decode('utf-8')
            hashed_codes.append(hashed)
        return hashed_codes
    
    @staticmethod
    def verify_backup_code(code: str, hashed_codes: List[str]) -> bool:
        """Verify a backup code against stored hashes"""
        if not code or not hashed_codes:
            return False
            
        # Clean the input code
        clean_code = code.replace('-', '').strip()
        
        for hashed_code in hashed_codes:
            try:
                if bcrypt.checkpw(clean_code.encode('utf-8'),
                                  hashed_code.encode('utf-8')):
                    return True
            except Exception:
                continue
        return False
    
    @staticmethod
    def setup_mfa(user_id: int, secret: str, backup_codes: List[str]) -> bool:
        """Enable MFA for a user with secret and backup codes"""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Hash backup codes
                hashed_codes = MFAService.hash_backup_codes(backup_codes)
                
                cursor.execute("""
                    UPDATE users 
                    SET mfa_enabled = TRUE, 
                        mfa_secret = %s, 
                        backup_codes = %s
                    WHERE id = %s
                """, (secret, json.dumps(hashed_codes), user_id))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            print(f"Error setting up MFA: {e}")
            return False
    
    @staticmethod
    def disable_mfa(user_id: int) -> bool:
        """Disable MFA for a user"""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    UPDATE users 
                    SET mfa_enabled = FALSE, 
                        mfa_secret = NULL, 
                        backup_codes = NULL
                    WHERE id = %s
                """, (user_id,))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            print(f"Error disabling MFA: {e}")
            return False
    
    @staticmethod
    def get_user_mfa_info(user_id: int) -> Optional[Dict]:
        """Get user's MFA status and information"""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT mfa_enabled, mfa_secret, backup_codes
                    FROM users 
                    WHERE id = %s
                """, (user_id,))
                
                result = cursor.fetchone()
                if not result:
                    return None
                
                mfa_enabled, mfa_secret, backup_codes = result
                
                return {
                    'mfa_enabled': mfa_enabled,
                    'has_secret': mfa_secret is not None,
                    'backup_codes_count': (
                        len(json.loads(backup_codes)) 
                        if backup_codes else 0
                    )
                }
                
        except Exception as e:
            print(f"Error getting user MFA info: {e}")
            return None
    
    @staticmethod
    def verify_user_mfa(user_id: int, token: str) -> Tuple[bool, str]:
        """
        Verify MFA token for a user (TOTP or backup code)
        Returns (success, method_used)
        """
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT mfa_secret, backup_codes
                    FROM users 
                    WHERE id = %s AND mfa_enabled = TRUE
                """, (user_id,))
                
                result = cursor.fetchone()
                if not result:
                    return False, "mfa_not_enabled"
                
                mfa_secret, backup_codes = result
                
                # First try TOTP verification
                if mfa_secret and MFAService.verify_totp(mfa_secret, token):
                    return True, "totp"
                
                # If TOTP fails, try backup codes
                if backup_codes:
                    hashed_codes = json.loads(backup_codes)
                    if MFAService.verify_backup_code(token, hashed_codes):
                        # Remove used backup code
                        MFAService._remove_used_backup_code(
                            user_id, token, hashed_codes
                        )
                        return True, "backup_code"
                
                return False, "invalid_token"
                
        except Exception as e:
            print(f"Error verifying user MFA: {e}")
            return False, "error"
    
    @staticmethod
    def _remove_used_backup_code(user_id: int, used_code: str, 
                                hashed_codes: List[str]) -> None:
        """Remove a used backup code from the database"""
        try:
            clean_code = used_code.replace('-', '').strip()
            updated_codes = []
            
            for hashed_code in hashed_codes:
                # Skip the code that was just used
                if not bcrypt.checkpw(clean_code.encode('utf-8'),
                                      hashed_code.encode('utf-8')):
                    updated_codes.append(hashed_code)
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE users 
                    SET backup_codes = %s
                    WHERE id = %s
                """, (json.dumps(updated_codes), user_id))
                conn.commit()
                
        except Exception as e:
            print(f"Error removing used backup code: {e}")
    
    @staticmethod
    def regenerate_backup_codes(user_id: int) -> Optional[List[str]]:
        """Generate new backup codes for a user"""
        try:
            # Generate new codes
            new_codes = MFAService.generate_backup_codes()
            hashed_codes = MFAService.hash_backup_codes(new_codes)
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    UPDATE users 
                    SET backup_codes = %s
                    WHERE id = %s AND mfa_enabled = TRUE
                """, (json.dumps(hashed_codes), user_id))
                
                conn.commit()
                
                if cursor.rowcount > 0:
                    return new_codes
                return None
                
        except Exception as e:
            print(f"Error regenerating backup codes: {e}")
            return None
