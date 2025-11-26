"""
Rotas de API para registro e verificação de documentos na blockchain
Substitui as antigas rotas /api/proxy/* (Toolblox deprecated na v1.4)
"""

from flask import Blueprint, request, jsonify
import logging
from api.auth import token_required
from api.utils.db import get_db_connection
from api.utils.nft import nft_manager
from api.utils.wallet import wallet_manager

logger = logging.getLogger(__name__)

document_bp = Blueprint('document', __name__)

@document_bp.route('/register', methods=['POST'])
@token_required
def register_document(current_user):
    """
    Registra um documento na blockchain usando a carteira proprietária
    
    Request Body:
        {
            "hash": "0x...",  // Hash do documento (bytes32)
            "document_name": "documento.pdf",  // opcional
            "document_url": "https://..."  // opcional
        }
    
    Returns:
        JSON com success, tx_hash, message
    """
    try:
        data = request.get_json()
        doc_hash = data.get('hash') or data.get('documentHash')
        document_name = data.get('document_name', 'Documento sem nome')
        document_url = data.get('document_url')
        
        if not doc_hash:
            return jsonify({'error': 'Hash do documento é obrigatório'}), 400
        
        # Normalizar hash (adicionar 0x se necessário)
        if not doc_hash.startswith('0x'):
            doc_hash = '0x' + doc_hash.strip().lower()
        
        # Validar comprimento (66 caracteres: 0x + 64 hex)
        if len(doc_hash) != 66:
            return jsonify({'error': 'Hash inválido (deve ter 64 caracteres hexadecimais)'}), 400
        
        user_id = current_user['user_id']
        
        # Obter dados da carteira
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT wallet_address, encrypted_private_key, wallet_salt, nft_active
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        result = cur.fetchone()
        
        if not result or not result[0]:
            cur.close()
            conn.close()
            return jsonify({'error': 'Usuário não possui carteira'}), 404
        
        wallet_address, encrypted_private_key, salt, nft_active = result
        
        # Verificar se tem NFT ativo
        if not nft_active:
            cur.close()
            conn.close()
            return jsonify({
                'error': 'NFT inativo ou não existente',
                'message': 'É necessário ter um NFT ativo para registrar documentos'
            }), 403
        
        # Obter senha do usuário (será solicitada no frontend)
        password = data.get('password')
        
        if not password:
            cur.close()
            conn.close()
            return jsonify({'error': 'Senha é obrigatória para registrar documento'}), 400
        
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
        
        # Registrar prova na blockchain
        try:
            proof_url = document_url or f"ipfs://blocktrust/{doc_hash}"
            
            proof_result = nft_manager.register_proof(
                doc_hash,
                proof_url,
                private_key
            )
            
            tx_hash = proof_result['transaction_hash']
            
            logger.info(f"✅ Documento registrado na blockchain: {tx_hash}")
            
        except Exception as e:
            logger.error(f"❌ Erro ao registrar documento na blockchain: {str(e)}")
            cur.close()
            conn.close()
            return jsonify({
                'error': 'Falha ao registrar documento na blockchain',
                'details': str(e)
            }), 500
        
        # Salvar registro no banco
        try:
            cur.execute("""
                INSERT INTO document_registrations 
                (user_id, file_hash, document_name, document_url, blockchain_tx, registered_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
            """, (user_id, doc_hash, document_name, document_url, tx_hash))
            
            conn.commit()
            
        except Exception as e:
            logger.error(f"❌ Erro ao salvar registro no banco: {str(e)}")
            # Não falhar se o banco der erro, pois o documento já foi registrado na blockchain
        
        finally:
            cur.close()
            conn.close()
        
        return jsonify({
            'success': True,
            'tx_hash': tx_hash,
            'message': 'Documento registrado com sucesso na blockchain!',
            'document_hash': doc_hash,
            'document_name': document_name
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao registrar documento: {str(e)}")
        return jsonify({
            'error': 'Erro ao registrar documento',
            'details': str(e)
        }), 500

@document_bp.route('/verify', methods=['POST'])
def verify_document():
    """
    Verifica se um documento está registrado na blockchain
    
    Request Body:
        {
            "hash": "0x..."  // Hash do documento (bytes32)
        }
    
    Returns:
        JSON com registered, proof_data, registration_info
    """
    try:
        data = request.get_json()
        doc_hash = data.get('hash') or data.get('documentHash')
        
        if not doc_hash:
            return jsonify({'error': 'Hash do documento é obrigatório'}), 400
        
        # Normalizar hash
        if not doc_hash.startswith('0x'):
            doc_hash = '0x' + doc_hash.strip().lower()
        
        # Validar comprimento
        if len(doc_hash) != 66:
            return jsonify({'error': 'Hash inválido (deve ter 64 caracteres hexadecimais)'}), 400
        
        # Verificar na blockchain
        try:
            is_registered = nft_manager.verify_proof(doc_hash)
            
            if not is_registered:
                return jsonify({
                    'registered': False,
                    'message': 'Documento não encontrado na blockchain'
                }), 200
            
        except Exception as e:
            logger.error(f"❌ Erro ao verificar documento na blockchain: {str(e)}")
            return jsonify({
                'error': 'Falha ao verificar documento na blockchain',
                'details': str(e)
            }), 500
        
        # Buscar informações no banco de dados
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT u.email, dr.document_name, dr.document_url, dr.registered_at, dr.blockchain_tx
            FROM document_registrations dr
            JOIN users u ON dr.user_id = u.id
            WHERE dr.file_hash = %s
            ORDER BY dr.registered_at DESC
            LIMIT 1
        """, (doc_hash,))
        
        db_record = cur.fetchone()
        cur.close()
        conn.close()
        
        result = {
            'registered': True,
            'on_blockchain': True,
            'document_hash': doc_hash
        }
        
        if db_record:
            result['registration_info'] = {
                'registered_by': db_record[0],
                'document_name': db_record[1],
                'document_url': db_record[2],
                'registered_at': db_record[3].isoformat() if db_record[3] else None,
                'blockchain_tx': db_record[4]
            }
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao verificar documento: {str(e)}")
        return jsonify({
            'error': 'Erro ao verificar documento',
            'details': str(e)
        }), 500

@document_bp.route('/history', methods=['GET'])
@token_required
def document_history(current_user):
    """
    Retorna o histórico de documentos registrados pelo usuário
    
    Returns:
        JSON com lista de documentos registrados
    """
    try:
        user_id = current_user['user_id']
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT file_hash, document_name, document_url, blockchain_tx, registered_at
            FROM document_registrations
            WHERE user_id = %s
            ORDER BY registered_at DESC
        """, (user_id,))
        
        records = cur.fetchall()
        cur.close()
        conn.close()
        
        documents = []
        for record in records:
            documents.append({
                'file_hash': record[0],
                'document_name': record[1],
                'document_url': record[2],
                'blockchain_tx': record[3],
                'registered_at': record[4].isoformat() if record[4] else None
            })
        
        return jsonify({
            'success': True,
            'documents': documents,
            'count': len(documents)
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao buscar histórico de documentos: {str(e)}")
        return jsonify({
            'error': 'Erro ao buscar histórico de documentos',
            'details': str(e)
        }), 500

