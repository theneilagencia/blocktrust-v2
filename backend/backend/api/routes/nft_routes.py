"""
Rotas de API para gerenciamento de NFTs SoulBound
"""

from flask import Blueprint, request, jsonify
import logging
from api.utils.nft import nft_manager
from api.utils.wallet import wallet_manager
from api.auth import token_required
from api.utils.db import get_db_connection

logger = logging.getLogger(__name__)

nft_bp = Blueprint('nft', __name__)

@nft_bp.route('/status', methods=['GET'])
@token_required
def get_nft_status(current_user):
    """
    Obtém status do NFT do usuário
    
    Returns:
        JSON com has_nft, nft_id, is_active
    """
    try:
        user_id = current_user['user_id']
        
        # Obter endereço da carteira
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT wallet_address, nft_id, nft_active
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if not result or not result[0]:
            return jsonify({'error': 'Usuário não possui carteira'}), 404
        
        wallet_address, db_nft_id, db_nft_active = result
        
        # Verificar NFT na blockchain
        blockchain_nft_id = nft_manager.get_active_nft(wallet_address)
        is_active = nft_manager.is_active_nft(wallet_address)
        
        return jsonify({
            'status': 'success',
            'has_nft': blockchain_nft_id is not None,
            'nft_id': blockchain_nft_id or db_nft_id,
            'is_active': is_active,
            'wallet_address': wallet_address
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao obter status do NFT: {str(e)}")
        return jsonify({'error': 'Erro ao obter status', 'details': str(e)}), 500

@nft_bp.route('/mint', methods=['POST'])
@token_required
def mint_nft(current_user):
    """
    Minta um novo NFT de identidade para o usuário
    
    Request Body:
        {
            "password": "senha_do_usuario",
            "metadata": {
                "kyc_status": "approved",
                "kyc_date": "2025-10-28",
                ...
            }
        }
    
    Returns:
        JSON com nft_id, transaction_hash
    """
    try:
        data = request.get_json()
        password = data.get('password')
        metadata = data.get('metadata', {})
        
        if not password:
            return jsonify({'error': 'Senha é obrigatória'}), 400
        
        user_id = current_user['user_id']
        
        # Obter dados da carteira
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT wallet_address, encrypted_private_key, wallet_salt, nft_id
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        result = cur.fetchone()
        
        if not result or not result[0]:
            cur.close()
            conn.close()
            return jsonify({'error': 'Usuário não possui carteira'}), 404
        
        wallet_address, encrypted_private_key, salt, current_nft_id = result
        
        # Verificar se há NFT anterior ativo
        previous_nft_id = nft_manager.get_active_nft(wallet_address)
        
        # Se houver NFT anterior, cancelar
        if previous_nft_id:
            logger.info(f"🔄 Cancelando NFT anterior {previous_nft_id} para usuário {user_id}")
            
            try:
                # Descriptografar chave privada
                private_key = wallet_manager.decrypt_private_key(
                    encrypted_private_key,
                    password,
                    salt
                )
                
                # Cancelar NFT anterior
                cancel_result = nft_manager.cancel_nft(previous_nft_id, private_key)
                
                logger.info(f"✅ NFT {previous_nft_id} cancelado: {cancel_result['transaction_hash']}")
                
                # Registrar cancelamento no banco
                cur.execute("""
                    INSERT INTO nft_cancellations (user_id, old_nft_id, cancelled_at, transaction_hash)
                    VALUES (%s, %s, NOW(), %s)
                """, (user_id, previous_nft_id, cancel_result['transaction_hash']))
                
                conn.commit()
                
            except Exception as e:
                logger.error(f"❌ Erro ao cancelar NFT anterior: {str(e)}")
                # Continuar mesmo se o cancelamento falhar
        
        # Mintar novo NFT
        try:
            # Descriptografar chave privada
            private_key = wallet_manager.decrypt_private_key(
                encrypted_private_key,
                password,
                salt
            )
            
            # Adicionar informações do usuário aos metadados
            full_metadata = {
                **metadata,
                'user_id': user_id,
                'wallet_address': wallet_address,
                'previous_nft_id': previous_nft_id or 0
            }
            
            # Mintar NFT
            mint_result = nft_manager.mint_identity_nft(
                wallet_address,
                full_metadata,
                previous_nft_id or 0,
                private_key
            )
            
            # Atualizar banco de dados
            cur.execute("""
                UPDATE users
                SET nft_id = %s,
                    nft_active = TRUE,
                    nft_minted_at = NOW(),
                    nft_transaction_hash = %s
                WHERE id = %s
            """, (mint_result['nft_id'], mint_result['transaction_hash'], user_id))
            
            conn.commit()
            cur.close()
            conn.close()
            
            logger.info(f"✅ NFT {mint_result['nft_id']} mintado para usuário {user_id}")
            
            return jsonify({
                'status': 'success',
                'nft_id': mint_result['nft_id'],
                'transaction_hash': mint_result['transaction_hash'],
                'block_number': mint_result['block_number'],
                'previous_nft_cancelled': previous_nft_id is not None,
                'previous_nft_id': previous_nft_id
            }), 201
            
        except ValueError:
            cur.close()
            conn.close()
            return jsonify({'error': 'Senha incorreta'}), 401
        
    except Exception as e:
        logger.error(f"❌ Erro ao mintar NFT: {str(e)}")
        return jsonify({'error': 'Erro ao mintar NFT', 'details': str(e)}), 500

@nft_bp.route('/cancel', methods=['POST'])
@token_required
def cancel_nft(current_user):
    """
    Cancela o NFT ativo do usuário
    
    Request Body:
        {
            "password": "senha_do_usuario",
            "reason": "motivo_do_cancelamento"
        }
    
    Returns:
        JSON com transaction_hash
    """
    try:
        data = request.get_json()
        password = data.get('password')
        reason = data.get('reason', 'User requested cancellation')
        
        if not password:
            return jsonify({'error': 'Senha é obrigatória'}), 400
        
        user_id = current_user['user_id']
        
        # Obter dados da carteira
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT wallet_address, encrypted_private_key, wallet_salt, nft_id
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        result = cur.fetchone()
        
        if not result or not result[0]:
            cur.close()
            conn.close()
            return jsonify({'error': 'Usuário não possui carteira'}), 404
        
        wallet_address, encrypted_private_key, salt, nft_id = result
        
        if not nft_id:
            cur.close()
            conn.close()
            return jsonify({'error': 'Usuário não possui NFT'}), 404
        
        # Descriptografar chave privada
        try:
            private_key = wallet_manager.decrypt_private_key(
                encrypted_private_key,
                password,
                salt
            )
        except ValueError:
            cur.close()
            conn.close()
            return jsonify({'error': 'Senha incorreta'}), 401
        
        # Cancelar NFT
        cancel_result = nft_manager.cancel_nft(nft_id, private_key)
        
        # Atualizar banco de dados
        cur.execute("""
            UPDATE users
            SET nft_active = FALSE
            WHERE id = %s
        """, (user_id,))
        
        cur.execute("""
            INSERT INTO nft_cancellations (user_id, old_nft_id, cancelled_at, transaction_hash, reason)
            VALUES (%s, %s, NOW(), %s, %s)
        """, (user_id, nft_id, cancel_result['transaction_hash'], reason))
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"✅ NFT {nft_id} cancelado para usuário {user_id}")
        
        return jsonify({
            'status': 'success',
            'nft_id': nft_id,
            'transaction_hash': cancel_result['transaction_hash'],
            'block_number': cancel_result['block_number']
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao cancelar NFT: {str(e)}")
        return jsonify({'error': 'Erro ao cancelar NFT', 'details': str(e)}), 500

@nft_bp.route('/history', methods=['GET'])
@token_required
def get_nft_history(current_user):
    """
    Obtém histórico de NFTs do usuário
    
    Returns:
        JSON com lista de NFTs (ativos e cancelados)
    """
    try:
        user_id = current_user['user_id']
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Obter NFT atual
        cur.execute("""
            SELECT nft_id, nft_active, nft_minted_at, nft_transaction_hash
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        current_nft = cur.fetchone()
        
        # Obter histórico de cancelamentos
        cur.execute("""
            SELECT old_nft_id, cancelled_at, transaction_hash, reason
            FROM nft_cancellations
            WHERE user_id = %s
            ORDER BY cancelled_at DESC
        """, (user_id,))
        
        cancellations = cur.fetchall()
        cur.close()
        conn.close()
        
        history = []
        
        # Adicionar NFT atual
        if current_nft and current_nft[0]:
            history.append({
                'nft_id': current_nft[0],
                'status': 'active' if current_nft[1] else 'cancelled',
                'minted_at': current_nft[2].isoformat() if current_nft[2] else None,
                'transaction_hash': current_nft[3]
            })
        
        # Adicionar NFTs cancelados
        for cancel in cancellations:
            history.append({
                'nft_id': cancel[0],
                'status': 'cancelled',
                'cancelled_at': cancel[1].isoformat() if cancel[1] else None,
                'transaction_hash': cancel[2],
                'reason': cancel[3]
            })
        
        return jsonify({
            'status': 'success',
            'history': history
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao obter histórico de NFTs: {str(e)}")
        return jsonify({'error': 'Erro ao obter histórico', 'details': str(e)}), 500

