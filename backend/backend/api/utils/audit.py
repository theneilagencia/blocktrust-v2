"""
Módulo de Auditoria - Blocktrust v1.4
Registra eventos importantes no banco de dados para auditoria
"""

import logging
from datetime import datetime
from api.utils.db import get_db_connection

logger = logging.getLogger(__name__)

def log_audit_event(event_type, user_id, payload, status='success'):
    """
    Registra evento de auditoria no banco de dados
    
    Args:
        event_type (str): Tipo do evento (ex: 'kyc_approved', 'nft_minted', 'failsafe_triggered')
        user_id (int): ID do usuário relacionado ao evento
        payload (dict): Dados adicionais do evento
        status (str): Status do evento ('success', 'error', 'pending')
    
    Returns:
        bool: True se salvou com sucesso, False caso contrário
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Criar tabela de auditoria se não existir
        cur.execute("""
            CREATE TABLE IF NOT EXISTS audit_events (
                id SERIAL PRIMARY KEY,
                event_type VARCHAR(100) NOT NULL,
                user_id INTEGER,
                payload JSONB,
                status VARCHAR(50) DEFAULT 'success',
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        
        # Criar índices para performance
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type);
            CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id);
            CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);
        """)
        
        # Inserir evento
        cur.execute("""
            INSERT INTO audit_events (event_type, user_id, payload, status)
            VALUES (%s, %s, %s, %s)
        """, (event_type, user_id, str(payload), status))
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"✅ Evento de auditoria registrado: {event_type} (user_id={user_id}, status={status})")
        return True
        
    except Exception as e:
        logger.error(f"❌ Erro ao registrar evento de auditoria: {str(e)}")
        return False

def log_kyc_event(user_id, event_type, applicant_id, review_status, details=None):
    """
    Registra evento específico de KYC
    
    Args:
        user_id (int): ID do usuário
        event_type (str): Tipo do evento ('kyc_started', 'kyc_approved', 'kyc_rejected', 'kyc_pending')
        applicant_id (str): ID do applicant na Sumsub
        review_status (str): Status da revisão
        details (dict): Detalhes adicionais
    
    Returns:
        bool: True se salvou com sucesso
    """
    payload = {
        'applicant_id': applicant_id,
        'review_status': review_status,
        'timestamp': datetime.now().isoformat()
    }
    
    if details:
        payload.update(details)
    
    return log_audit_event(
        event_type=f'kyc_{event_type}',
        user_id=user_id,
        payload=payload,
        status='success' if event_type == 'approved' else 'pending'
    )

def log_nft_event(user_id, event_type, nft_id, tx_hash, details=None):
    """
    Registra evento específico de NFT
    
    Args:
        user_id (int): ID do usuário
        event_type (str): Tipo do evento ('minted', 'canceled', 'transferred')
        nft_id (int): ID do NFT
        tx_hash (str): Hash da transação
        details (dict): Detalhes adicionais
    
    Returns:
        bool: True se salvou com sucesso
    """
    payload = {
        'nft_id': nft_id,
        'tx_hash': tx_hash,
        'timestamp': datetime.now().isoformat()
    }
    
    if details:
        payload.update(details)
    
    return log_audit_event(
        event_type=f'nft_{event_type}',
        user_id=user_id,
        payload=payload,
        status='success'
    )

def log_failsafe_event(user_id, reason, nft_id=None, details=None):
    """
    Registra evento de failsafe (senha de coação usada)
    
    Args:
        user_id (int): ID do usuário
        reason (str): Motivo do failsafe
        nft_id (int): ID do NFT cancelado (se aplicável)
        details (dict): Detalhes adicionais
    
    Returns:
        bool: True se salvou com sucesso
    """
    payload = {
        'reason': reason,
        'timestamp': datetime.now().isoformat()
    }
    
    if nft_id:
        payload['nft_id'] = nft_id
    
    if details:
        payload.update(details)
    
    return log_audit_event(
        event_type='failsafe_triggered',
        user_id=user_id,
        payload=payload,
        status='success'
    )

def get_user_audit_log(user_id, limit=50):
    """
    Obtém log de auditoria de um usuário
    
    Args:
        user_id (int): ID do usuário
        limit (int): Número máximo de eventos a retornar
    
    Returns:
        list: Lista de eventos de auditoria
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id, event_type, payload, status, created_at
            FROM audit_events
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT %s
        """, (user_id, limit))
        
        events = []
        for row in cur.fetchall():
            events.append({
                'id': row[0],
                'event_type': row[1],
                'payload': row[2],
                'status': row[3],
                'created_at': row[4].isoformat() if row[4] else None
            })
        
        cur.close()
        conn.close()
        
        return events
        
    except Exception as e:
        logger.error(f"❌ Erro ao obter log de auditoria: {str(e)}")
        return []

