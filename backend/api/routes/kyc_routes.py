"""
Rotas de KYC - Sistema Self-Custodial Unificado
Elimina armazenamento de chaves privadas e implementa geração determinística
"""
from flask import Blueprint, request, jsonify
from api.auth import token_required
from api.utils.sumsub import (
    create_applicant,
    get_access_token,
    get_applicant_status,
    verify_webhook_signature,
    get_applicant_bio_hash,  # Nova função para extrair bioHash
    validate_credentials
)
from api.utils.db import get_db_connection
from api.utils.audit import log_kyc_event, log_nft_event
from api.utils.crypto import validate_bio_hash  # Função de validação
from api.utils.blockchain import (
    mint_identity_nft,  # Função unificada
    generate_deterministic_address,
    validate_wallet_for_biohash
)
import logging
import hashlib

logger = logging.getLogger(__name__)

kyc_bp = Blueprint('kyc', __name__)

@kyc_bp.route('/init', methods=['POST'])
@token_required
def init_kyc(current_user):
    """
    Inicializa processo de KYC - Sistema Self-Custodial
    
    Não mais gera ou armazena chaves privadas!
    """
    try:
        # Valida credenciais do Sumsub
        is_valid, error_msg = validate_credentials()
        if not is_valid:
            logger.error(f"❌ Credenciais Sumsub inválidas: {error_msg}")
            return jsonify({
                'error': 'Configuração inválida',
                'message': 'Credenciais Sumsub não configuradas.',
                'details': error_msg
            }), 500
        
        user_id = current_user.id
        user_email = current_user.email
        
        # Verifica se usuário já tem identidade ativa
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT kyc_status, applicant_id, bio_hash_fingerprint, nft_token_id 
            FROM users 
            WHERE id = %s
        """, (user_id,))
        
        user_data = cur.fetchone()
        
        if user_data and user_data['kyc_status'] == 'APPROVED':
            # Usuário já tem KYC aprovado
            logger.info(f"👤 Usuário {user_id} já possui KYC aprovado")
            
            return jsonify({
                'status': 'already_approved',
                'message': 'Você já possui uma identidade verificada',
                'nft_token_id': user_data['nft_token_id'],
                'has_biohash': bool(user_data['bio_hash_fingerprint'])
            })
        
        # Cria novo aplicante no Sumsub
        applicant_data = create_applicant(
            external_user_id=user_id,
            level_name='basic-kyc-level',  # Configurar no Sumsub
            email=user_email
        )
        
        if not applicant_data:
            logger.error(f"❌ Falha ao criar applicant para usuário {user_id}")
            return jsonify({
                'error': 'Erro na inicialização',
                'message': 'Não foi possível inicializar o processo de verificação'
            }), 500
        
        applicant_id = applicant_data['id']
        
        # Salva dados do aplicante (SEM chave privada!)
        cur.execute("""
            UPDATE users 
            SET applicant_id = %s, 
                kyc_status = 'PENDING',
                kyc_started_at = NOW(),
                updated_at = NOW()
            WHERE id = %s
        """, (applicant_id, user_id))
        
        conn.commit()
        
        # Gera access token para o SDK
        access_token = get_access_token(applicant_id, 'one-time')
        
        if not access_token:
            logger.error(f"❌ Falha ao gerar access token para {applicant_id}")
            return jsonify({
                'error': 'Erro no token',
                'message': 'Não foi possível gerar token de acesso'
            }), 500
        
        # Log do evento
        log_kyc_event(
            user_id=user_id,
            event_type='KYC_INITIATED',
            applicant_id=applicant_id,
            details={'system': 'self-custodial'}
        )
        
        logger.info(f"✅ KYC iniciado para usuário {user_id}, applicant: {applicant_id}")
        
        return jsonify({
            'status': 'success',
            'access_token': access_token,
            'applicant_id': applicant_id,
            'message': 'Processo de verificação iniciado'
        })
        
    except Exception as e:
        logger.error(f"❌ Erro ao iniciar KYC: {str(e)}")
        return jsonify({
            'error': 'Erro interno',
            'message': 'Falha na inicialização do processo de verificação'
        }), 500
    
    finally:
        if 'conn' in locals():
            conn.close()

@kyc_bp.route('/status', methods=['GET'])
@token_required
def get_kyc_status(current_user):
    """
    Verifica status do KYC e retorna dados necessários para geração de wallet
    """
    try:
        user_id = current_user.id
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT applicant_id, kyc_status, bio_hash_fingerprint, 
                   nft_token_id, wallet_address, kyc_completed_at
            FROM users 
            WHERE id = %s
        """, (user_id,))
        
        user_data = cur.fetchone()
        
        if not user_data or not user_data['applicant_id']:
            return jsonify({
                'status': 'not_initiated',
                'message': 'Processo de verificação não foi iniciado'
            })
        
        applicant_id = user_data['applicant_id']
        
        # Consulta status no Sumsub
        sumsub_status = get_applicant_status(applicant_id)
        
        if not sumsub_status:
            return jsonify({
                'status': 'error',
                'message': 'Erro ao consultar status na Sumsub'
            }), 500
        
        status_data = {
            'applicant_id': applicant_id,
            'status': sumsub_status.get('reviewStatus', 'pending'),
            'sumsub_status': sumsub_status
        }
        
        # Se aprovado, inclui dados para geração de wallet
        if sumsub_status.get('reviewStatus') == 'completed':
            # Extrai bioHash do Sumsub
            bio_hash = get_applicant_bio_hash(applicant_id)
            
            if bio_hash:
                # Gera endereço determinístico
                wallet_address = generate_deterministic_address(bio_hash)
                
                status_data.update({
                    'bio_hash': bio_hash,
                    'wallet_address': wallet_address,
                    'ready_for_mint': True
                })
                
                # Atualiza dados no banco se necessário
                if user_data['kyc_status'] != 'COMPLETED':
                    bio_hash_fingerprint = hashlib.sha256(bio_hash.encode()).hexdigest()
                    
                    cur.execute("""
                        UPDATE users 
                        SET kyc_status = 'COMPLETED',
                            bio_hash_fingerprint = %s,
                            wallet_address = %s,
                            kyc_completed_at = NOW(),
                            updated_at = NOW()
                        WHERE id = %s
                    """, (bio_hash_fingerprint, wallet_address, user_id))
                    
                    conn.commit()
                    
                    log_kyc_event(
                        user_id=user_id,
                        event_type='KYC_COMPLETED',
                        applicant_id=applicant_id,
                        details={
                            'wallet_address': wallet_address,
                            'bio_hash_fingerprint': bio_hash_fingerprint
                        }
                    )
            else:
                status_data['error'] = 'Dados biométricos não disponíveis'
        
        return jsonify(status_data)
        
    except Exception as e:
        logger.error(f"❌ Erro ao verificar status KYC: {str(e)}")
        return jsonify({
            'error': 'Erro interno',
            'message': 'Falha ao verificar status'
        }), 500
    
    finally:
        if 'conn' in locals():
            conn.close()

@kyc_bp.route('/mint-nft', methods=['POST'])
@token_required
def mint_identity_nft_endpoint(current_user):
    """
    Mint do NFT de identidade usando bioHash
    """
    try:
        user_id = current_user.id
        data = request.get_json()
        
        required_fields = ['bio_hash', 'wallet_address']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'error': 'Dados incompletos',
                    'message': f'Campo {field} é obrigatório'
                }), 400
        
        bio_hash = data['bio_hash']
        wallet_address = data['wallet_address']
        
        # Valida bioHash
        if not validate_bio_hash(bio_hash):
            return jsonify({
                'error': 'BioHash inválido',
                'message': 'Dados biométricos não são válidos'
            }), 400
        
        # Verifica se endereço corresponde ao bioHash
        expected_address = generate_deterministic_address(bio_hash)
        if wallet_address.lower() != expected_address.lower():
            return jsonify({
                'error': 'Endereço inconsistente',
                'message': 'Endereço da wallet não corresponde aos dados biométricos'
            }), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Busca dados do usuário
        cur.execute("""
            SELECT applicant_id, kyc_status, nft_token_id, 
                   bio_hash_fingerprint, name, document_number
            FROM users 
            WHERE id = %s
        """, (user_id,))
        
        user_data = cur.fetchone()
        
        if not user_data or user_data['kyc_status'] != 'COMPLETED':
            return jsonify({
                'error': 'KYC não aprovado',
                'message': 'Processo de verificação deve ser concluído primeiro'
            }), 400
        
        if user_data['nft_token_id']:
            return jsonify({
                'status': 'already_minted',
                'nft_token_id': user_data['nft_token_id'],
                'message': 'NFT já foi criado para esta identidade'
            })
        
        # Executa mint do NFT
        result = mint_identity_nft(
            wallet_address=wallet_address,
            name=user_data['name'] or 'Usuário Blocktrust',
            document_number=user_data['document_number'] or 'N/A',
            bio_hash=bio_hash,
            applicant_id=user_data['applicant_id']
        )
        
        if not result['success']:
            logger.error(f"❌ Falha no mint NFT: {result['error']}")
            return jsonify({
                'error': 'Erro no mint',
                'message': 'Falha ao criar NFT de identidade',
                'details': result['error']
            }), 500
        
        token_id = result['token_id']
        tx_hash = result['tx_hash']
        
        # Atualiza banco
        cur.execute("""
            UPDATE users 
            SET nft_token_id = %s,
                nft_tx_hash = %s,
                nft_minted_at = NOW(),
                updated_at = NOW()
            WHERE id = %s
        """, (token_id, tx_hash, user_id))
        
        conn.commit()
        
        # Log do evento
        log_nft_event(
            user_id=user_id,
            event_type='NFT_MINTED',
            token_id=token_id,
            tx_hash=tx_hash,
            details={
                'wallet_address': wallet_address,
                'bio_hash_used': True,
                'version': '2.0'
            }
        )
        
        logger.info(f"✅ NFT criado para usuário {user_id}: Token ID {token_id}")
        
        return jsonify({
            'status': 'success',
            'token_id': token_id,
            'tx_hash': tx_hash,
            'wallet_address': wallet_address,
            'message': 'Identidade NFT criada com sucesso'
        })
        
    except Exception as e:
        logger.error(f"❌ Erro no mint NFT: {str(e)}")
        return jsonify({
            'error': 'Erro interno',
            'message': 'Falha ao criar NFT de identidade'
        }), 500
    
    finally:
        if 'conn' in locals():
            conn.close()

@kyc_bp.route('/recover-identity', methods=['POST'])
@token_required
def recover_identity(current_user):
    """
    Endpoint para recuperação de identidade usando bioHash
    """
    try:
        data = request.get_json()
        
        if 'bio_hash' not in data:
            return jsonify({
                'error': 'Dados incompletos',
                'message': 'BioHash é obrigatório'
            }), 400
        
        bio_hash = data['bio_hash']
        
        # Valida bioHash
        if not validate_bio_hash(bio_hash):
            return jsonify({
                'error': 'BioHash inválido',
                'message': 'Dados biométricos não são válidos'
            }), 400
        
        # Gera endereço determinístico
        wallet_address = generate_deterministic_address(bio_hash)
        
        # Verifica se existe identidade na blockchain
        blockchain_identity = validate_wallet_for_biohash(wallet_address, bio_hash)
        
        if not blockchain_identity['valid']:
            return jsonify({
                'status': 'not_found',
                'message': 'Nenhuma identidade encontrada para estes dados biométricos'
            })
        
        # Busca dados no banco local (se existir)
        conn = get_db_connection()
        cur = conn.cursor()
        
        bio_hash_fingerprint = hashlib.sha256(bio_hash.encode()).hexdigest()
        
        cur.execute("""
            SELECT id, name, document_number, applicant_id, nft_token_id
            FROM users 
            WHERE bio_hash_fingerprint = %s OR wallet_address = %s
        """, (bio_hash_fingerprint, wallet_address))
        
        local_data = cur.fetchone()
        
        recovery_data = {
            'status': 'found',
            'wallet_address': wallet_address,
            'token_id': blockchain_identity['token_id'],
            'bio_hash': bio_hash,
            'blockchain_data': blockchain_identity['identity_data']
        }
        
        if local_data:
            recovery_data.update({
                'local_user_id': local_data['id'],
                'name': local_data['name'],
                'document_number': local_data['document_number']
            })
        
        logger.info(f"🔑 Identidade recuperada para endereço {wallet_address}")
        
        return jsonify(recovery_data)
        
    except Exception as e:
        logger.error(f"❌ Erro na recuperação de identidade: {str(e)}")
        return jsonify({
            'error': 'Erro interno',
            'message': 'Falha na recuperação de identidade'
        }), 500
    
    finally:
        if 'conn' in locals():
            conn.close()

@kyc_bp.route('/webhook', methods=['POST'])
def kyc_webhook():
    """
    Webhook do Sumsub - Processa eventos de aprovação automaticamente
    """
    try:
        # Verifica assinatura do webhook
        # Sumsub usa X-Payload-Digest (formato: sha256=hash ou apenas hash)
        # Também verificamos X-Payload-Signature para compatibilidade
        signature = request.headers.get('X-Payload-Digest') or request.headers.get('X-Payload-Signature')
        payload = request.get_data()
        
        if not verify_webhook_signature(payload, signature):
            logger.warning("⚠️ Webhook com assinatura inválida")
            return jsonify({'error': 'Assinatura inválida'}), 401
        
        webhook_data = request.get_json()
        
        if not webhook_data:
            return jsonify({'error': 'Payload inválido'}), 400
        
        applicant_id = webhook_data.get('applicantId')
        review_status = webhook_data.get('reviewStatus')
        
        if not applicant_id:
            return jsonify({'error': 'ApplicantId obrigatório'}), 400
        
        logger.info(f"📨 Webhook recebido: {applicant_id} - Status: {review_status}")
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Busca usuário pelo applicant_id
        cur.execute("""
            SELECT id, kyc_status FROM users 
            WHERE applicant_id = %s
        """, (applicant_id,))
        
        user_data = cur.fetchone()
        
        if not user_data:
            logger.warning(f"⚠️ Usuário não encontrado para applicant_id: {applicant_id}")
            return jsonify({'status': 'user_not_found'}), 404
        
        user_id = user_data['id']
        
        # Processa status
        if review_status == 'completed':
            # KYC aprovado - prepara dados para mint
            bio_hash = get_applicant_bio_hash(applicant_id)
            
            if bio_hash:
                wallet_address = generate_deterministic_address(bio_hash)
                bio_hash_fingerprint = hashlib.sha256(bio_hash.encode()).hexdigest()
                
                cur.execute("""
                    UPDATE users 
                    SET kyc_status = 'COMPLETED',
                        bio_hash_fingerprint = %s,
                        wallet_address = %s,
                        kyc_completed_at = NOW(),
                        updated_at = NOW()
                    WHERE id = %s
                """, (bio_hash_fingerprint, wallet_address, user_id))
                
                conn.commit()
                
                log_kyc_event(
                    user_id=user_id,
                    event_type='KYC_APPROVED_WEBHOOK',
                    applicant_id=applicant_id,
                    details={'wallet_address': wallet_address}
                )
                
                logger.info(f"✅ KYC aprovado via webhook: Usuário {user_id}")
                
        elif review_status == 'rejected':
            # KYC rejeitado
            cur.execute("""
                UPDATE users 
                SET kyc_status = 'REJECTED',
                    updated_at = NOW()
                WHERE id = %s
            """, (user_id,))
            
            conn.commit()
            
            log_kyc_event(
                user_id=user_id,
                event_type='KYC_REJECTED_WEBHOOK',
                applicant_id=applicant_id,
                details=webhook_data
            )
            
            logger.info(f"❌ KYC rejeitado via webhook: Usuário {user_id}")
        
        return jsonify({'status': 'processed'})
        
    except Exception as e:
        logger.error(f"❌ Erro no webhook: {str(e)}")
        return jsonify({'error': 'Erro interno'}), 500
    
    finally:
        if 'conn' in locals():
            conn.close()


@kyc_bp.route('/get-sumsub-token', methods=['POST'])
@token_required
def get_sumsub_token(current_user):
    """
    Gera token de acesso do Sumsub para o usuário
    
    Body:
        email: Email do usuário
        phone: Telefone do usuário (opcional)
        
    Returns:
        token: Token de acesso do Sumsub
        applicantId: ID do aplicante
    """
    try:
        user_id = current_user.id
        data = request.get_json()
        
        email = data.get('email')
        phone = data.get('phone', '')
        
        if not email:
            return jsonify({'error': 'Email obrigatório'}), 400
        
        # Usa função existente para obter token
        token_data = get_access_token(str(user_id), email)
        
        if not token_data:
            return jsonify({'error': 'Erro ao gerar token do Sumsub'}), 500
        
        return jsonify({
            'token': token_data,
            'applicantId': str(user_id)  # Usando user_id como aplicantId
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao obter token do Sumsub: {str(e)}")
        return jsonify({'error': 'Erro interno do servidor'}), 500


@kyc_bp.route('/get-biohash', methods=['POST'])
@token_required
def get_biohash(current_user):
    """
    Obtém bioHash do Sumsub para um applicantId
    
    Body:
        applicantId: ID do aplicante no Sumsub
        
    Returns:
        bioHash: Hash biométrico único
        applicantId: ID do aplicante
    """
    try:
        data = request.get_json()
        applicant_id = data.get('applicantId')
        
        if not applicant_id:
            return jsonify({'error': 'applicantId obrigatório'}), 400
        
        # Usa função existente para obter bioHash
        bio_hash = get_applicant_bio_hash(applicant_id)
        
        if not bio_hash:
            return jsonify({'error': 'BioHash não encontrado'}), 404
        
        return jsonify({
            'bioHash': bio_hash,
            'applicantId': applicant_id
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao obter bioHash: {str(e)}")
        return jsonify({'error': 'Erro interno do servidor'}), 500


def register_kyc_routes(app):
    """Registra as rotas do KYC"""
    app.register_blueprint(kyc_bp, url_prefix='/api/kyc')
