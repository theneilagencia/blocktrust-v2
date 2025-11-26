"""
Rotas de API para assinatura de documentos com suporte a failsafe
"""

from flask import Blueprint, request, jsonify
import logging
import hashlib
from api.utils.wallet import wallet_manager
from api.utils.nft import nft_manager
from api.auth import token_required
from api.utils.db import get_db_connection

logger = logging.getLogger(__name__)

signature_bp = Blueprint('signature', __name__)

@signature_bp.route('/sign-document', methods=['POST'])
@token_required
def sign_document(current_user):
    """
    Assina um documento usando a carteira do usuário
    
    Request Body:
        {
            "file_hash": "hash_do_documento",
            "password": "senha_do_usuario",
            "failsafe": false,  // opcional, default false
            "document_name": "nome_do_documento.pdf",  // opcional
            "document_url": "url_do_documento"  // opcional
        }
    
    Returns:
        JSON com signature, transaction_hash (se blockchain), failsafe_triggered
    """
    try:
        data = request.get_json()
        file_hash = data.get('file_hash')
        password = data.get('password')
        failsafe = data.get('failsafe', False)
        document_name = data.get('document_name', 'Documento sem nome')
        document_url = data.get('document_url')
        
        if not file_hash:
            return jsonify({'error': 'Hash do documento é obrigatório'}), 400
        
        if not password:
            return jsonify({'error': 'Senha é obrigatória'}), 400
        
        user_id = current_user['user_id']
        
        # Obter dados da carteira e senha de emergência
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT wallet_address, encrypted_private_key, wallet_salt, nft_id, nft_active,
                   password_hash, failsafe_password_hash, failsafe_configured
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        result = cur.fetchone()
        
        if not result or not result[0]:
            cur.close()
            conn.close()
            return jsonify({'error': 'Usuário não possui carteira'}), 404
        
        wallet_address, encrypted_private_key, salt, nft_id, nft_active, password_hash, failsafe_hash, failsafe_configured = result
        
        # DETECTAR AUTOMATICAMENTE SE É FAILSAFE
        import bcrypt
        is_failsafe = False
        
        # Verificar se a senha é a senha de emergência
        if failsafe_configured and failsafe_hash:
            if bcrypt.checkpw(password.encode('utf-8'), failsafe_hash.encode('utf-8')):
                is_failsafe = True
                logger.warning(f"🚨 SENHA DE EMERGÊNCIA DETECTADA para usuário {user_id}")
        
        # Se não é failsafe, verificar se é a senha normal
        if not is_failsafe:
            if not bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8')):
                cur.close()
                conn.close()
                return jsonify({'error': 'Senha incorreta'}), 401
        
        # MODO FAILSAFE (detectado automaticamente pela senha)
        if is_failsafe:
            logger.warning(f"🚨 FAILSAFE ACIONADO por usuário {user_id} para documento {document_name}")
            
            # Gerar assinatura fake
            signature_data = wallet_manager.generate_failsafe_signature(file_hash)
            
            # Atualizar último acionamento de failsafe
            cur.execute("""
                UPDATE users
                SET last_failsafe_trigger = NOW()
                WHERE id = %s
            """, (user_id,))
            
            # Registrar evento de failsafe
            cur.execute("""
                INSERT INTO failsafe_events (user_id, message, triggered_at, nft_cancelled)
                VALUES (%s, %s, NOW(), %s)
            """, (user_id, f"Failsafe acionado para documento: {document_name}", False))
            
            failsafe_event_id = cur.lastrowid
            
            # Cancelar NFT se existir
            if nft_id and nft_active:
                try:
                    # Descriptografar chave privada
                    private_key = wallet_manager.decrypt_private_key(
                        encrypted_private_key,
                        password,
                        salt
                    )
                    
                    # Cancelar NFT
                    cancel_result = nft_manager.cancel_nft(nft_id, private_key)
                    
                    # Atualizar banco
                    cur.execute("""
                        UPDATE users
                        SET nft_active = FALSE
                        WHERE id = %s
                    """, (user_id,))
                    
                    cur.execute("""
                        UPDATE failsafe_events
                        SET nft_cancelled = TRUE
                        WHERE id = %s
                    """, (failsafe_event_id,))
                    
                    cur.execute("""
                        INSERT INTO nft_cancellations (user_id, old_nft_id, cancelled_at, transaction_hash, reason)
                        VALUES (%s, %s, NOW(), %s, %s)
                    """, (user_id, nft_id, cancel_result['transaction_hash'], 'Failsafe triggered'))
                    
                    logger.warning(f"🚨 NFT {nft_id} cancelado por failsafe: {cancel_result['transaction_hash']}")
                    
                except Exception as e:
                    logger.error(f"❌ Erro ao cancelar NFT no failsafe: {str(e)}")
            
            # Registrar assinatura fake no banco
            cur.execute("""
                INSERT INTO document_signatures 
                (user_id, file_hash, signature, document_name, document_url, failsafe, signed_at)
                VALUES (%s, %s, %s, %s, %s, TRUE, NOW())
            """, (user_id, file_hash, signature_data['signature'], document_name, document_url))
            
            conn.commit()
            cur.close()
            conn.close()
            
            return jsonify({
                'status': 'failsafe',
                'failsafe_triggered': True,
                'nft_cancelled': nft_id is not None and nft_active,
                **signature_data,
                'message': 'ASSINATURA DE EMERGÊNCIA ACIONADA - NFT FOI CANCELADO'
            }), 200
        
        # MODO NORMAL
        # Verificar se tem NFT ativo
        if not nft_active:
            cur.close()
            conn.close()
            return jsonify({
                'error': 'NFT inativo ou não existente',
                'message': 'É necessário ter um NFT ativo para assinar documentos'
            }), 403
        
        # Verificar NFT na blockchain
        is_active_blockchain = nft_manager.is_active_nft(wallet_address)
        
        if not is_active_blockchain:
            cur.close()
            conn.close()
            return jsonify({
                'error': 'NFT não está ativo na blockchain',
                'message': 'Sincronize seu NFT antes de assinar'
            }), 403
        
        # Assinar documento
        try:
            signature_data = wallet_manager.sign_message(
                file_hash,
                encrypted_private_key,
                password,
                salt
            )
            
            # Registrar prova na blockchain
            try:
                private_key = wallet_manager.decrypt_private_key(
                    encrypted_private_key,
                    password,
                    salt
                )
                
                proof_url = document_url or f"ipfs://blocktrust/{file_hash}"
                
                proof_result = nft_manager.register_proof(
                    file_hash,
                    proof_url,
                    private_key
                )
                
                logger.info(f"✅ Prova registrada na blockchain: {proof_result['transaction_hash']}")
                
                blockchain_tx = proof_result['transaction_hash']
                
            except Exception as e:
                logger.error(f"❌ Erro ao registrar prova na blockchain: {str(e)}")
                blockchain_tx = None
            
            # Registrar assinatura no banco
            cur.execute("""
                INSERT INTO document_signatures 
                (user_id, file_hash, signature, document_name, document_url, failsafe, blockchain_tx, signed_at)
                VALUES (%s, %s, %s, %s, %s, FALSE, %s, NOW())
            """, (user_id, file_hash, signature_data['signature'], document_name, document_url, blockchain_tx))
            
            conn.commit()
            cur.close()
            conn.close()
            
            logger.info(f"✅ Documento assinado por usuário {user_id}: {document_name}")
            
            return jsonify({
                'status': 'success',
                'failsafe_triggered': False,
                **signature_data,
                'blockchain_tx': blockchain_tx,
                'document_name': document_name
            }), 200
            
        except ValueError:
            cur.close()
            conn.close()
            return jsonify({'error': 'Senha incorreta'}), 401
        
    except Exception as e:
        logger.error(f"❌ Erro ao assinar documento: {str(e)}")
        return jsonify({'error': 'Erro ao assinar documento', 'details': str(e)}), 500

@signature_bp.route('/verify', methods=['POST'])
def verify_signature():
    """
    Verifica a validade de uma assinatura de documento
    
    Request Body:
        {
            "file_hash": "hash_do_documento",
            "signature": "0x...",
            "address": "0x..."
        }
    
    Returns:
        JSON com valid, on_blockchain, signer_address
    """
    try:
        data = request.get_json()
        file_hash = data.get('file_hash')
        signature = data.get('signature')
        address = data.get('address')
        
        if not all([file_hash, signature, address]):
            return jsonify({'error': 'Campos obrigatórios: file_hash, signature, address'}), 400
        
        # Verificar assinatura
        is_valid = wallet_manager.verify_signature(file_hash, signature, address)
        
        # Verificar se está na blockchain
        on_blockchain = nft_manager.verify_proof(file_hash)
        
        # Verificar no banco de dados
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT u.email, ds.signed_at, ds.document_name, ds.failsafe
            FROM document_signatures ds
            JOIN users u ON ds.user_id = u.id
            JOIN users u2 ON u2.wallet_address = %s
            WHERE ds.file_hash = %s AND ds.signature = %s
        """, (address, file_hash, signature))
        
        db_record = cur.fetchone()
        cur.close()
        conn.close()
        
        result = {
            'status': 'success',
            'valid': is_valid,
            'on_blockchain': on_blockchain,
            'signer_address': address
        }
        
        if db_record:
            result['signer_email'] = db_record[0]
            result['signed_at'] = db_record[1].isoformat() if db_record[1] else None
            result['document_name'] = db_record[2]
            result['failsafe'] = db_record[3]
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao verificar assinatura: {str(e)}")
        return jsonify({'error': 'Erro ao verificar assinatura', 'details': str(e)}), 500

@signature_bp.route('/history', methods=['GET'])
@token_required
def get_signature_history(current_user):
    """
    Obtém histórico de assinaturas do usuário
    
    Returns:
        JSON com lista de assinaturas
    """
    try:
        user_id = current_user['user_id']
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT file_hash, signature, document_name, document_url, 
                   failsafe, blockchain_tx, signed_at
            FROM document_signatures
            WHERE user_id = %s
            ORDER BY signed_at DESC
        """, (user_id,))
        
        signatures = cur.fetchall()
        cur.close()
        conn.close()
        
        history = []
        for sig in signatures:
            history.append({
                'file_hash': sig[0],
                'signature': sig[1],
                'document_name': sig[2],
                'document_url': sig[3],
                'failsafe': sig[4],
                'blockchain_tx': sig[5],
                'signed_at': sig[6].isoformat() if sig[6] else None
            })
        
        return jsonify({
            'status': 'success',
            'history': history,
            'total': len(history)
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao obter histórico de assinaturas: {str(e)}")
        return jsonify({'error': 'Erro ao obter histórico', 'details': str(e)}), 500

@signature_bp.route('/hash-file', methods=['POST'])
@token_required
def hash_file(current_user):
    """
    Gera hash SHA256 de um arquivo
    
    Request Body:
        {
            "file_content": "conteúdo_do_arquivo_em_base64"
        }
    
    Returns:
        JSON com file_hash
    """
    try:
        data = request.get_json()
        file_content = data.get('file_content')
        
        if not file_content:
            return jsonify({'error': 'Conteúdo do arquivo é obrigatório'}), 400
        
        # Gerar hash
        file_hash = hashlib.sha256(file_content.encode()).hexdigest()
        
        logger.info(f"✅ Hash gerado para usuário {current_user['user_id']}: {file_hash[:16]}...")
        
        return jsonify({
            'status': 'success',
            'file_hash': file_hash
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao gerar hash: {str(e)}")
        return jsonify({'error': 'Erro ao gerar hash', 'details': str(e)}), 500

