"""
Rotas PGP e Assinatura Dupla - Blocktrust v1.4
"""

from flask import Blueprint, request, jsonify
from functools import wraps
import jwt
import os
import logging
import hashlib
from datetime import datetime
from ..utils.pgp import (
    import_public_key,
    verify_signature,
    get_public_key,
    calculate_pgp_sig_hash,
    fingerprint_to_bytes20
)

logger = logging.getLogger(__name__)

pgp_bp = Blueprint('pgp', __name__, url_prefix='/api/pgp')
dual_bp = Blueprint('dual', __name__, url_prefix='/api/dual')

JWT_SECRET = os.getenv('JWT_SECRET', 'blocktrust_secret')

# Decorator para autenticação JWT
def jwt_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401
        
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            request.user_id = payload['user_id']
            request.user_email = payload['email']
            return f(*args, **kwargs)
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expirado'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token inválido'}), 401
    
    return decorated

@pgp_bp.route('/import', methods=['POST'])
@jwt_required
def import_pgp_key():
    """
    Importa chave pública PGP do usuário
    
    Body:
        {
            "armored_pubkey": "-----BEGIN PGP PUBLIC KEY BLOCK-----..."
        }
    
    Returns:
        {
            "success": true,
            "fingerprint": "...",
            "key_id": "...",
            "uids": [...]
        }
    """
    try:
        data = request.get_json()
        armored_pubkey = data.get('armored_pubkey')
        
        if not armored_pubkey:
            return jsonify({'error': 'Chave pública não fornecida'}), 400
        
        # Importar chave
        result = import_public_key(armored_pubkey)
        
        if not result['success']:
            return jsonify({'error': result['error']}), 400
        
        # Salvar no banco de dados
        from ..database import get_db_connection
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            UPDATE users
            SET pgp_fingerprint = %s,
                pgp_public_key = %s,
                pgp_imported_at = NOW()
            WHERE id = %s
        """, (result['fingerprint'], armored_pubkey, request.user_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"✅ Chave PGP importada para usuário {request.user_id}")
        
        return jsonify({
            'success': True,
            'fingerprint': result['fingerprint'],
            'key_id': result['key_id'],
            'uids': result['uids']
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao importar chave PGP: {str(e)}")
        return jsonify({'error': str(e)}), 500

@pgp_bp.route('/key', methods=['GET'])
@jwt_required
def get_pgp_key():
    """
    Retorna chave pública PGP do usuário logado
    
    Returns:
        {
            "fingerprint": "...",
            "public_key": "-----BEGIN PGP PUBLIC KEY BLOCK-----...",
            "imported_at": "2025-10-28T..."
        }
    """
    try:
        from ..database import get_db_connection
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT pgp_fingerprint, pgp_public_key, pgp_imported_at
            FROM users
            WHERE id = %s
        """, (request.user_id,))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if not result or not result[0]:
            return jsonify({'error': 'Chave PGP não encontrada'}), 404
        
        return jsonify({
            'fingerprint': result[0],
            'public_key': result[1],
            'imported_at': result[2].isoformat() if result[2] else None
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao obter chave PGP: {str(e)}")
        return jsonify({'error': str(e)}), 500

@dual_bp.route('/sign', methods=['POST'])
@jwt_required
def sign_dual():
    """
    Assina documento com PGP + Blockchain
    
    Body:
        {
            "doc_hash": "0x...",
            "pgp_signature": "-----BEGIN PGP SIGNATURE-----...",
            "pgp_fingerprint": "...",
            "nft_id": 123
        }
    
    Returns:
        {
            "success": true,
            "tx_hash": "0x...",
            "pgp_sig_hash": "0x...",
            "timestamp": "2025-10-28T..."
        }
    """
    try:
        data = request.get_json()
        
        doc_hash = data.get('doc_hash')
        pgp_signature = data.get('pgp_signature')
        pgp_fingerprint = data.get('pgp_fingerprint')
        nft_id = data.get('nft_id')
        
        # Validações
        if not all([doc_hash, pgp_signature, pgp_fingerprint, nft_id]):
            return jsonify({'error': 'Parâmetros incompletos'}), 400
        
        # Verificar se o fingerprint pertence ao usuário
        from ..database import get_db_connection
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT pgp_fingerprint, pgp_public_key
            FROM users
            WHERE id = %s
        """, (request.user_id,))
        
        user_data = cur.fetchone()
        
        if not user_data or not user_data[0]:
            cur.close()
            conn.close()
            return jsonify({'error': 'Usuário não possui chave PGP importada'}), 400
        
        if user_data[0].upper() != pgp_fingerprint.upper():
            cur.close()
            conn.close()
            return jsonify({'error': 'Fingerprint não corresponde ao usuário'}), 403
        
        # Importar chave pública do usuário
        import_result = import_public_key(user_data[1])
        
        if not import_result['success']:
            cur.close()
            conn.close()
            return jsonify({'error': f'Erro ao importar chave: {import_result["error"]}'}), 500
        
        # Verificar assinatura PGP
        verify_result = verify_signature(doc_hash, pgp_signature, pgp_fingerprint)
        
        if not verify_result['valid']:
            cur.close()
            conn.close()
            return jsonify({'error': f'Assinatura PGP inválida: {verify_result.get("error", "Desconhecido")}'}), 400
        
        # Calcular hash da assinatura PGP
        pgp_sig_hash = calculate_pgp_sig_hash(pgp_signature)
        
        # Converter fingerprint para bytes20
        fp_bytes20 = fingerprint_to_bytes20(pgp_fingerprint)
        
        # TODO: Chamar contrato ProofRegistry.storeDual
        # Por enquanto, apenas simular
        tx_hash = "0x" + hashlib.sha256(f"{doc_hash}{pgp_sig_hash}".encode()).hexdigest()
        
        # Salvar no banco de dados
        cur.execute("""
            INSERT INTO dual_sign_logs (
                user_id,
                doc_hash,
                pgp_fingerprint,
                pgp_signature,
                pgp_sig_hash,
                nft_id,
                blockchain_tx,
                ip_address,
                user_agent,
                created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            RETURNING id
        """, (
            request.user_id,
            doc_hash,
            pgp_fingerprint,
            pgp_signature,
            pgp_sig_hash,
            nft_id,
            tx_hash,
            request.remote_addr,
            request.headers.get('User-Agent', '')
        ))
        
        log_id = cur.fetchone()[0]
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"✅ Assinatura dupla criada: log_id={log_id}, user_id={request.user_id}")
        
        return jsonify({
            'success': True,
            'log_id': log_id,
            'tx_hash': tx_hash,
            'pgp_sig_hash': pgp_sig_hash,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao criar assinatura dupla: {str(e)}")
        return jsonify({'error': str(e)}), 500

@dual_bp.route('/verify', methods=['POST'])
@jwt_required
def verify_dual():
    """
    Verifica assinatura dupla (PGP + Blockchain)
    
    Body:
        {
            "doc_hash": "0x...",
            "pgp_signature": "-----BEGIN PGP SIGNATURE-----...",
            "pgp_fingerprint": "..."
        }
    
    Returns:
        {
            "valid": true,
            "pgp_valid": true,
            "blockchain_valid": true,
            "nft_active": true,
            "tx_hash": "0x...",
            "signer": "0x...",
            "timestamp": "2025-10-28T..."
        }
    """
    try:
        data = request.get_json()
        
        doc_hash = data.get('doc_hash')
        pgp_signature = data.get('pgp_signature')
        pgp_fingerprint = data.get('pgp_fingerprint')
        
        # Validações
        if not all([doc_hash, pgp_signature, pgp_fingerprint]):
            return jsonify({'error': 'Parâmetros incompletos'}), 400
        
        # Buscar chave pública pelo fingerprint
        from ..database import get_db_connection
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id, pgp_public_key
            FROM users
            WHERE pgp_fingerprint = %s
        """, (pgp_fingerprint,))
        
        user_data = cur.fetchone()
        
        if not user_data:
            cur.close()
            conn.close()
            return jsonify({
                'valid': False,
                'reason': 'Chave PGP não encontrada no sistema'
            }), 404
        
        user_id, public_key = user_data
        
        # Importar chave pública
        import_result = import_public_key(public_key)
        
        if not import_result['success']:
            cur.close()
            conn.close()
            return jsonify({
                'valid': False,
                'reason': f'Erro ao importar chave: {import_result["error"]}'
            }), 500
        
        # Verificar assinatura PGP
        verify_result = verify_signature(doc_hash, pgp_signature, pgp_fingerprint)
        
        pgp_valid = verify_result['valid']
        
        # Buscar registro no banco de dados
        pgp_sig_hash = calculate_pgp_sig_hash(pgp_signature)
        
        cur.execute("""
            SELECT id, nft_id, blockchain_tx, created_at
            FROM dual_sign_logs
            WHERE doc_hash = %s
            AND pgp_sig_hash = %s
            AND user_id = %s
            ORDER BY created_at DESC
            LIMIT 1
        """, (doc_hash, pgp_sig_hash, user_id))
        
        log_data = cur.fetchone()
        
        cur.close()
        conn.close()
        
        if not log_data:
            return jsonify({
                'valid': False,
                'pgp_valid': pgp_valid,
                'blockchain_valid': False,
                'reason': 'Assinatura não encontrada na blockchain'
            }), 404
        
        log_id, nft_id, tx_hash, timestamp = log_data
        
        # TODO: Verificar NFT ativo via IdentityNFT.isActive(nft_id)
        # Por enquanto, assumir ativo
        nft_active = True
        
        return jsonify({
            'valid': pgp_valid and nft_active,
            'pgp_valid': pgp_valid,
            'blockchain_valid': True,
            'nft_active': nft_active,
            'nft_id': nft_id,
            'tx_hash': tx_hash,
            'timestamp': timestamp.isoformat(),
            'fingerprint': pgp_fingerprint
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao verificar assinatura dupla: {str(e)}")
        return jsonify({'error': str(e)}), 500

