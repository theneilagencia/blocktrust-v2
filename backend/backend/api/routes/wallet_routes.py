"""
Rotas de API para gerenciamento de carteiras proprietárias
"""

from flask import Blueprint, request, jsonify
import logging
from api.utils.wallet import wallet_manager
from api.auth import token_required
from api.utils.db import get_db_connection

logger = logging.getLogger(__name__)

wallet_bp = Blueprint('wallet', __name__)

@wallet_bp.route('/init', methods=['POST'])
@token_required
def initialize_wallet(current_user):
    """
    Inicializa uma nova carteira para o usuário
    
    Request Body:
        {
            "password": "senha_do_usuario"
        }
    
    Returns:
        JSON com wallet_id, address, public_key
    """
    try:
        data = request.get_json()
        password = data.get('password')
        
        if not password:
            return jsonify({'error': 'Senha é obrigatória'}), 400
        
        # Verificar se usuário já tem carteira
        user_id = current_user['user_id']
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT wallet_id FROM users WHERE id = %s
        """, (user_id,))
        
        existing_wallet = cur.fetchone()
        
        if existing_wallet and existing_wallet[0]:
            cur.close()
            conn.close()
            return jsonify({'error': 'Usuário já possui uma carteira'}), 400
        
        # Gerar nova carteira
        wallet_data = wallet_manager.generate_wallet(password)
        
        # Salvar no banco de dados
        cur.execute("""
            UPDATE users
            SET wallet_id = %s,
                wallet_address = %s,
                encrypted_private_key = %s,
                wallet_salt = %s,
                wallet_created_at = NOW()
            WHERE id = %s
        """, (
            wallet_data['wallet_id'],
            wallet_data['address'],
            wallet_data['encrypted_private_key'],
            wallet_data['salt'],
            user_id
        ))
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"✅ Carteira criada para usuário {user_id}: {wallet_data['address']}")
        
        # Retornar apenas dados públicos
        return jsonify({
            'status': 'success',
            'wallet_id': wallet_data['wallet_id'],
            'address': wallet_data['address'],
            'public_key': wallet_data['public_key'],
            'message': 'Carteira criada com sucesso'
        }), 201
        
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(f"❌ Erro ao inicializar carteira: {str(e)}")
        logger.error(f"Traceback completo: {error_traceback}")
        return jsonify({'error': 'Erro ao criar carteira', 'details': str(e), 'traceback': error_traceback}), 500

@wallet_bp.route('/info', methods=['GET'])
@token_required
def get_wallet_info(current_user):
    """
    Obtém informações públicas da carteira do usuário
    
    Returns:
        JSON com wallet_id, address, public_key
    """
    try:
        user_id = current_user['user_id']
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT wallet_id, wallet_address, wallet_created_at
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if not result or not result[0]:
            return jsonify({'error': 'Usuário não possui carteira'}), 404
        
        return jsonify({
            'status': 'success',
            'wallet_id': result[0],
            'address': result[1],
            'public_key': result[1],  # Endereço Ethereum é a chave pública
            'created_at': result[2].isoformat() if result[2] else None
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao obter informações da carteira: {str(e)}")
        return jsonify({'error': 'Erro ao obter carteira', 'details': str(e)}), 500

@wallet_bp.route('/sign', methods=['POST'])
@token_required
def sign_message(current_user):
    """
    Assina uma mensagem usando a carteira do usuário
    
    Request Body:
        {
            "message": "mensagem_a_ser_assinada",
            "password": "senha_do_usuario",
            "failsafe": false  // opcional, default false
        }
    
    Returns:
        JSON com signature, message_hash, address
    """
    try:
        data = request.get_json()
        message = data.get('message')
        password = data.get('password')
        failsafe = data.get('failsafe', False)
        
        if not message:
            return jsonify({'error': 'Mensagem é obrigatória'}), 400
        
        # Se failsafe, gerar assinatura fake
        if failsafe:
            logger.warning(f"🚨 FAILSAFE ACIONADO por usuário {current_user['user_id']}")
            
            signature_data = wallet_manager.generate_failsafe_signature(message)
            
            # Registrar evento de failsafe no banco
            conn = get_db_connection()
            cur = conn.cursor()
            
            cur.execute("""
                INSERT INTO failsafe_events (user_id, message, triggered_at)
                VALUES (%s, %s, NOW())
            """, (current_user['user_id'], message))
            
            conn.commit()
            cur.close()
            conn.close()
            
            return jsonify({
                'status': 'failsafe',
                **signature_data
            }), 200
        
        # Assinatura normal
        if not password:
            return jsonify({'error': 'Senha é obrigatória'}), 400
        
        # Obter dados da carteira
        user_id = current_user['user_id']
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT encrypted_private_key, wallet_salt, wallet_address
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if not result or not result[0]:
            return jsonify({'error': 'Usuário não possui carteira'}), 404
        
        encrypted_private_key, salt, address = result
        
        # Assinar mensagem
        try:
            signature_data = wallet_manager.sign_message(
                message,
                encrypted_private_key,
                password,
                salt
            )
            
            logger.info(f"✅ Mensagem assinada por usuário {user_id}")
            
            return jsonify({
                'status': 'success',
                **signature_data
            }), 200
            
        except ValueError:
            return jsonify({'error': 'Senha incorreta'}), 401
        
    except Exception as e:
        logger.error(f"❌ Erro ao assinar mensagem: {str(e)}")
        return jsonify({'error': 'Erro ao assinar mensagem', 'details': str(e)}), 500

@wallet_bp.route('/verify', methods=['POST'])
def verify_signature():
    """
    Verifica se uma assinatura é válida (endpoint público)
    
    Request Body:
        {
            "message": "mensagem_original",
            "signature": "0x...",
            "address": "0x..."
        }
    
    Returns:
        JSON com valid (bool) e address
    """
    try:
        data = request.get_json()
        message = data.get('message')
        signature = data.get('signature')
        address = data.get('address')
        
        if not all([message, signature, address]):
            return jsonify({'error': 'Campos obrigatórios: message, signature, address'}), 400
        
        # Verificar assinatura
        is_valid = wallet_manager.verify_signature(message, signature, address)
        
        return jsonify({
            'status': 'success',
            'valid': is_valid,
            'address': address
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao verificar assinatura: {str(e)}")
        return jsonify({'error': 'Erro ao verificar assinatura', 'details': str(e)}), 500

@wallet_bp.route('/export-public-key', methods=['GET'])
@token_required
def export_public_key(current_user):
    """
    Exporta apenas a chave pública (endereço) da carteira
    
    Returns:
        JSON com address e public_key
    """
    try:
        user_id = current_user['user_id']
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT wallet_address
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if not result or not result[0]:
            return jsonify({'error': 'Usuário não possui carteira'}), 404
        
        address = result[0]
        
        logger.info(f"📤 Chave pública exportada para usuário {user_id}")
        
        return jsonify({
            'status': 'success',
            'address': address,
            'public_key': address,
            'message': 'Chave pública exportada com sucesso'
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao exportar chave pública: {str(e)}")
        return jsonify({'error': 'Erro ao exportar chave', 'details': str(e)}), 500

