"""
Integração com Sumsub para KYC e Liveness Check
"""
import os
import requests
import time
import hmac
import hashlib
import json
import logging

logger = logging.getLogger(__name__)

SUMSUB_APP_TOKEN = os.getenv('SUMSUB_APP_TOKEN')
SUMSUB_SECRET_KEY = os.getenv('SUMSUB_SECRET_KEY')
SUMSUB_WEBHOOK_SECRET = os.getenv('SUMSUB_WEBHOOK_SECRET', SUMSUB_SECRET_KEY)
SUMSUB_BASE_URL = 'https://api.sumsub.com'
SUMSUB_LEVEL_NAME = os.getenv('SUMSUB_LEVEL_NAME', 'basic-kyc-level')

def validate_credentials():
    """
    Valida se as credenciais do Sumsub estão configuradas
    
    Returns:
        Tuple (bool, str): (is_valid, error_message)
    """
    if not SUMSUB_APP_TOKEN:
        return False, "SUMSUB_APP_TOKEN não configurado"
    if not SUMSUB_SECRET_KEY:
        return False, "SUMSUB_SECRET_KEY não configurado"
    return True, None

def retry_request(func, max_retries=3, delays=[2, 4, 8]):
    """
    Executa uma função com retry e backoff exponencial
    
    Args:
        func: Função a ser executada
        max_retries: Número máximo de tentativas
        delays: Lista de delays entre tentativas (em segundos)
    
    Returns:
        Resultado da função ou None em caso de falha
    """
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            logger.error(f"Tentativa {attempt + 1}/{max_retries} falhou: {str(e)}")
            if attempt < max_retries - 1:
                delay = delays[attempt] if attempt < len(delays) else delays[-1]
                logger.info(f"Aguardando {delay}s antes da próxima tentativa...")
                time.sleep(delay)
            else:
                logger.error(f"Todas as {max_retries} tentativas falharam")
                raise

def generate_signature(method, url, body='', ts=None):
    """
    Gera assinatura HMAC SHA256 para requisições Sumsub
    
    Args:
        method: Método HTTP (GET, POST, etc.)
        url: URL do endpoint (path relativo)
        body: Corpo da requisição (opcional)
        ts: Timestamp (opcional, gerado automaticamente se não fornecido)
    
    Returns:
        Tupla (timestamp, signature)
    """
    if not SUMSUB_SECRET_KEY:
        raise ValueError("SUMSUB_SECRET_KEY não configurado")
    
    if ts is None:
        ts = str(int(time.time()))
    
    # Converte body para string se for dict
    if isinstance(body, dict):
        body = json.dumps(body)
    
    signature_string = f'{ts}{method.upper()}{url}{body}'
    
    signature = hmac.new(
        SUMSUB_SECRET_KEY.encode('utf-8'),
        signature_string.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return ts, signature

def get_headers(method, url, body=''):
    """
    Gera headers para requisições Sumsub
    
    Args:
        method: Método HTTP
        url: URL do endpoint
        body: Corpo da requisição (opcional)
    
    Returns:
        Dict com headers necessários
    """
    if not SUMSUB_APP_TOKEN:
        raise ValueError("SUMSUB_APP_TOKEN não configurado")
    
    ts, signature = generate_signature(method, url, body)
    
    return {
        'X-App-Token': SUMSUB_APP_TOKEN,
        'X-App-Access-Ts': ts,
        'X-App-Access-Sig': signature,
        'Content-Type': 'application/json'
    }

def create_applicant(external_user_id, email, level_name=None):
    """
    Cria um applicant no Sumsub com tratamento completo de erros
    
    Args:
        external_user_id: ID do usuário no sistema
        email: Email do usuário
        level_name: Nome do nível de verificação (opcional)
    
    Returns:
        Dict com status e dados do applicant ou erro detalhado
    """
    # CORREÇÃO: levelName deve ser passado como query parameter, não no body
    level = level_name or SUMSUB_LEVEL_NAME
    url = f'/resources/applicants?levelName={level}'
    method = 'POST'
    
    body = {
        'externalUserId': str(external_user_id)
    }
    
    # Adicionar email apenas se fornecido (é opcional segundo a documentação)
    if email:
        body['email'] = email
    
    try:
        # Converter body para JSON string para assinatura HMAC
        body_json = json.dumps(body)
        headers = get_headers(method, url, body_json)
        response = requests.post(
            f'{SUMSUB_BASE_URL}{url}',
            json=body,
            headers=headers,
            timeout=30
        )
        
        # --- Erro de Assinatura HMAC ---
        if response.status_code == 401 and 'signature' in response.text.lower():
            logger.error("❌ ERRO HMAC: Assinatura inválida (verifique Secret Key).")
            return {
                'status': 'error',
                'type': 'HMAC_SIGNATURE_ERROR',
                'message': 'Assinatura inválida — a Secret Key não corresponde ao App Token.',
                'action': 'Regere a Secret Key no painel Sumsub e atualize SUMSUB_SECRET_KEY no Render.'
            }
        
        # --- Outros erros de API ---
        if response.status_code >= 400:
            error_text = response.text
            logger.error(f"❌ ERRO AO CRIAR APPLICANT [{response.status_code}]: {error_text}")
            return {
                'status': 'error',
                'type': 'API_ERROR',
                'code': response.status_code,
                'message': error_text,
                'action': 'Verifique o levelName, App Token e permissões do projeto Sumsub.'
            }
        
        # --- Sucesso ---
        data = response.json()
        applicant_id = data.get('id')
        logger.info(f"✅ Applicant criado com sucesso: {applicant_id}")
        return {
            'status': 'success',
            'applicant_id': applicant_id,
            'data': data,
            'mock_mode': False
        }
        
    except requests.exceptions.RequestException as e:
        logger.error(f"🌐 ERRO DE REDE COM SUMSUB: {str(e)}")
        return {
            'status': 'error',
            'type': 'NETWORK_ERROR',
            'message': str(e),
            'action': 'Verifique conectividade ou endpoint da API Sumsub.'
        }
    
    except Exception as e:
        logger.error(f"💥 ERRO DESCONHECIDO: {str(e)}")
        return {
            'status': 'error',
            'type': 'UNKNOWN_ERROR',
            'message': str(e),
            'action': 'Erro inesperado ao criar applicant. Verifique logs do servidor.'
        }

def get_access_token(external_user_id, level_name=None, ttl_in_secs=600):
    """
    Gera token de acesso para o SDK do Sumsub
    
    Args:
        external_user_id: ID do usuário no sistema
        level_name: Nome do nível de verificação (opcional)
        ttl_in_secs: Tempo de validade do token em segundos (padrão: 10 minutos)
    
    Returns:
        Dict com token e expiração
    """
    url = f'/resources/accessTokens?userId={external_user_id}'
    
    if level_name:
        url += f'&levelName={level_name}'
    else:
        url += f'&levelName={SUMSUB_LEVEL_NAME}'
    
    url += f'&ttlInSecs={ttl_in_secs}'
    
    method = 'POST'
    
    try:
        headers = get_headers(method, url)
        response = requests.post(
            f'{SUMSUB_BASE_URL}{url}',
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        
        data = response.json()
        logger.info(f"Access token gerado para: {external_user_id}")
        
        return {
            'token': data.get('token'),
            'userId': external_user_id,
            'expiresAt': int(time.time()) + ttl_in_secs
        }
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Erro ao gerar access token: {str(e)}")
        raise

def get_applicant_status(applicant_id):
    """
    Obtém status de verificação do applicant
    
    Args:
        applicant_id: ID do applicant no Sumsub
    
    Returns:
        Dict com status da verificação
    """
    url = f'/resources/applicants/{applicant_id}/status'
    method = 'GET'
    
    try:
        headers = get_headers(method, url)
        response = requests.get(
            f'{SUMSUB_BASE_URL}{url}',
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        
        return response.json()
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Erro ao obter status do applicant: {str(e)}")
        raise

def get_applicant_data(applicant_id):
    """
    Obtém dados completos do applicant
    
    Args:
        applicant_id: ID do applicant no Sumsub
    
    Returns:
        Dict com dados do applicant
    """
    url = f'/resources/applicants/{applicant_id}/one'
    method = 'GET'
    
    try:
        headers = get_headers(method, url)
        response = requests.get(
            f'{SUMSUB_BASE_URL}{url}',
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        
        return response.json()
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Erro ao obter dados do applicant: {str(e)}")
        raise

def verify_webhook_signature(request_body, signature_header):
    """
    Verifica assinatura HMAC do webhook do Sumsub com logs detalhados
    
    Args:
        request_body: Corpo da requisição (bytes ou string)
        signature_header: Header X-Payload-Digest (formato: "sha256=hash" ou apenas "hash")
    
    Returns:
        Boolean indicando se a assinatura é válida
    """
    if not signature_header:
        logger.warning("⚠️ Webhook sem cabeçalho X-Payload-Digest — ignorado.")
        return False
    
    if not SUMSUB_SECRET_KEY:
        logger.error("❌ SUMSUB_SECRET_KEY não configurado")
        return False
    
    try:
        # Converter body para bytes se necessário
        if isinstance(request_body, str):
            request_body = request_body.encode('utf-8')
        
        # Remover prefixo "sha256=" se presente
        received_signature = signature_header.replace('sha256=', '').strip()
        
        # Calcular assinatura esperada
        expected_signature = hmac.new(
            SUMSUB_SECRET_KEY.encode('utf-8'),
            request_body,
            hashlib.sha256
        ).hexdigest()
        
        # Comparar assinaturas
        if not hmac.compare_digest(expected_signature, received_signature):
            logger.error("❌ FALHA DE VERIFICAÇÃO HMAC: Assinatura não confere.")
            logger.debug(f"Esperada: {expected_signature} | Recebida: {received_signature}")
            return False
        
        logger.info("✅ Assinatura HMAC do webhook validada com sucesso.")
        return True
        
    except Exception as e:
        logger.error(f"💥 ERRO AO VALIDAR HMAC DO WEBHOOK: {str(e)}")
        return False

def parse_verification_status(status_data):
    """
    Parseia status de verificação do Sumsub
    
    Args:
        status_data: Dados de status retornados pela API
    
    Returns:
        Dict com status simplificado
    """
    review_status = status_data.get('reviewStatus', 'init')
    review_result = status_data.get('reviewResult', {})
    
    # Mapeamento de status
    status_map = {
        'init': 'pending',
        'pending': 'pending',
        'queued': 'pending',
        'completed': 'approved' if review_result.get('reviewAnswer') == 'GREEN' else 'rejected',
        'onHold': 'on_hold'
    }
    
    return {
        'status': status_map.get(review_status, 'unknown'),
        'reviewStatus': review_status,
        'reviewAnswer': review_result.get('reviewAnswer'),
        'rejectLabels': review_result.get('rejectLabels', []),
        'reviewRejectType': review_result.get('reviewRejectType'),
        'moderationComment': review_result.get('moderationComment', '')
    }

def is_kyc_approved(status_data):
    """
    Verifica se o KYC foi aprovado
    
    Args:
        status_data: Dados de status retornados pela API
    
    Returns:
        Boolean indicando se o KYC foi aprovado
    """
    parsed = parse_verification_status(status_data)
    return parsed['status'] == 'approved'

def get_liveness_check_status(applicant_id):
    """
    Obtém status específico do liveness check
    
    Args:
        applicant_id: ID do applicant no Sumsub
    
    Returns:
        Dict com status do liveness check
    """
    try:
        status = get_applicant_status(applicant_id)
        
        # Verifica se há liveness check nos documentos
        liveness_status = {
            'completed': False,
            'passed': False,
            'details': None
        }
        
        if 'reviewResult' in status:
            review_result = status['reviewResult']
            
            # Verifica se há liveness check aprovado
            if review_result.get('reviewAnswer') == 'GREEN':
                liveness_status['completed'] = True
                liveness_status['passed'] = True
            elif review_result.get('reviewAnswer') in ['RED', 'YELLOW']:
                liveness_status['completed'] = True
                liveness_status['passed'] = False
                liveness_status['details'] = review_result.get('rejectLabels', [])
        
        return liveness_status
        
    except Exception as e:
        logger.error(f"Erro ao obter status do liveness check: {str(e)}")
        raise

def get_applicant_bio_hash(applicant_id):
    """
    Extrai bioHash dos dados biométricos do aplicante
    
    Args:
        applicant_id: ID do aplicante no Sumsub
        
    Returns:
        str: BioHash único do aplicante ou None se não disponível
    """
    try:
        # Obtém dados completos do aplicante
        applicant_data = get_applicant_data(applicant_id)
        
        if not applicant_data:
            logger.error(f"Dados do aplicante {applicant_id} não encontrados")
            return None
        
        # Extrai bioHash dos dados de verificação
        # O bioHash geralmente está em applicantData.fixedInfo ou similarData
        bio_hash = None
        
        if 'info' in applicant_data:
            info_data = applicant_data['info']
            
            # Procura por dados biométricos em diferentes locais possíveis
            if 'fixedInfo' in info_data and 'bioHash' in info_data['fixedInfo']:
                bio_hash = info_data['fixedInfo']['bioHash']
            elif 'similarData' in info_data and 'bioHash' in info_data['similarData']:
                bio_hash = info_data['similarData']['bioHash']
            elif 'biometricData' in info_data:
                # Se os dados biométricos estão em formato diferente
                biometric_data = info_data['biometricData']
                if isinstance(biometric_data, dict) and 'hash' in biometric_data:
                    bio_hash = biometric_data['hash']
        
        # Se não encontrou nos dados principais, tenta nas verificações
        if not bio_hash and 'checks' in applicant_data:
            for check in applicant_data['checks']:
                if check.get('checkType') == 'IDENTITY' and 'bioHash' in check:
                    bio_hash = check['bioHash']
                    break
        
        # Fallback: gera bioHash determinístico baseado em dados únicos
        if not bio_hash:
            logger.warning(f"BioHash não encontrado para {applicant_id}, gerando fallback")
            bio_hash = generate_fallback_bio_hash(applicant_data, applicant_id)
        
        if bio_hash:
            logger.info(f"BioHash extraído para aplicante {applicant_id}")
            return bio_hash
        else:
            logger.error(f"Não foi possível extrair bioHash para {applicant_id}")
            return None
            
    except Exception as e:
        logger.error(f"Erro ao extrair bioHash para {applicant_id}: {str(e)}")
        return None

def generate_fallback_bio_hash(applicant_data, applicant_id):
    """
    Gera bioHash de fallback baseado em dados únicos do aplicante
    
    Args:
        applicant_data: Dados completos do aplicante
        applicant_id: ID do aplicante
        
    Returns:
        str: BioHash gerado deterministicamente
    """
    try:
        # Combina dados únicos para gerar hash consistente
        unique_data = []
        
        # Adiciona ID do aplicante
        unique_data.append(applicant_id)
        
        # Adiciona dados pessoais se disponíveis
        if 'info' in applicant_data:
            info = applicant_data['info']
            
            # Dados básicos
            if 'firstName' in info:
                unique_data.append(info['firstName'])
            if 'lastName' in info:
                unique_data.append(info['lastName'])
            if 'dob' in info:
                unique_data.append(info['dob'])
            if 'phone' in info:
                unique_data.append(info['phone'])
            
            # Dados de documento
            if 'idDocs' in info:
                for doc in info['idDocs']:
                    if 'number' in doc:
                        unique_data.append(doc['number'])
        
        # Combina todos os dados únicos
        combined_data = '|'.join(str(data) for data in unique_data if data)
        
        # Gera hash SHA-256
        bio_hash = hashlib.sha256(combined_data.encode()).hexdigest()
        
        logger.info(f"BioHash de fallback gerado para {applicant_id}")
        return bio_hash
        
    except Exception as e:
        logger.error(f"Erro ao gerar bioHash de fallback: {str(e)}")
        return None

