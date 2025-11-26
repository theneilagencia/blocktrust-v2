"""
Rotas de API para configuração de senha de emergência (Failsafe)
"""

from flask import Blueprint, request, jsonify
import logging
import bcrypt
from api.auth import token_required
from api.utils.db import get_db_connection

logger = logging.getLogger(__name__)

failsafe_bp = Blueprint('failsafe', __name__)

@failsafe_bp.route('/configure', methods=['POST'])
@token_required
def configure_failsafe(current_user):
    """
    Configura senha de emergência (failsafe) para o usuário
    
    Request Body:
        {
            "current_password": "senha_atual",
            "failsafe_password": "senha_de_emergencia"
        }
    
    Returns:
        JSON com confirmação
    """
    try:
        data = request.get_json()
        current_password = data.get('current_password')
        failsafe_password = data.get('failsafe_password')
        
        if not current_password or not failsafe_password:
            return jsonify({'error': 'Senhas são obrigatórias'}), 400
        
        # Validar que as senhas são diferentes
        if current_password == failsafe_password:
            return jsonify({'error': 'Senha de emergência deve ser diferente da senha normal'}), 400
        
        user_id = current_user['user_id']
        
        # Verificar senha atual
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT password_hash
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        result = cur.fetchone()
        
        if not result:
            cur.close()
            conn.close()
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        password_hash = result[0]
        
        # Verificar senha atual
        if not bcrypt.checkpw(current_password.encode('utf-8'), password_hash.encode('utf-8')):
            cur.close()
            conn.close()
            return jsonify({'error': 'Senha atual incorreta'}), 401
        
        # Gerar hash da senha de emergência
        failsafe_hash = bcrypt.hashpw(failsafe_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Salvar no banco
        cur.execute("""
            UPDATE users
            SET failsafe_password_hash = %s,
                failsafe_configured = TRUE
            WHERE id = %s
        """, (failsafe_hash, user_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"✅ Senha de emergência configurada para usuário {user_id}")
        
        return jsonify({
            'status': 'success',
            'message': 'Senha de emergência configurada com sucesso'
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao configurar senha de emergência: {str(e)}")
        return jsonify({'error': str(e)}), 500

@failsafe_bp.route('/status', methods=['GET'])
@token_required
def get_failsafe_status(current_user):
    """
    Verifica se o usuário tem senha de emergência configurada
    
    Returns:
        JSON com status
    """
    try:
        user_id = current_user['user_id']
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT failsafe_configured, last_failsafe_trigger
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if not result:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        failsafe_configured, last_trigger = result
        
        return jsonify({
            'failsafe_configured': failsafe_configured or False,
            'last_trigger': last_trigger.isoformat() if last_trigger else None
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao obter status do failsafe: {str(e)}")
        return jsonify({'error': str(e)}), 500

