"""
Rotas de API para JWT Explorer - Blocktrust v1.2
"""

from flask import Blueprint, request, jsonify
import jwt
import datetime
import os
import logging
import json
from api.utils.db import get_db_connection

logger = logging.getLogger(__name__)

explorer_bp = Blueprint('explorer', __name__)

JWT_SECRET = os.getenv('JWT_SECRET', 'blocktrust_secret')
JWT_EXPIRATION_HOURS = 12

@explorer_bp.route('/login', methods=['POST'])
def login():
    """
    Login para JWT Explorer
    
    Request Body:
        {
            "email": "admin@bts.com",
            "password": "123"
        }
    
    Returns:
        JSON com token JWT
    """
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        # Credenciais fixas para admin
        if email != 'admin@bts.com' or password != '123':
            return jsonify({'error': 'Credenciais inválidas'}), 401
        
        # Gerar token JWT
        token = jwt.encode({
            'email': email,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRATION_HOURS)
        }, JWT_SECRET, algorithm='HS256')
        
        logger.info(f"✅ Login bem-sucedido: {email}")
        
        return jsonify({
            'status': 'success',
            'token': token,
            'expires_in': JWT_EXPIRATION_HOURS * 3600
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro no login: {str(e)}")
        return jsonify({'error': 'Erro no login', 'details': str(e)}), 500

@explorer_bp.route('/events', methods=['GET'])
def get_events():
    """
    Obtém lista de eventos da blockchain
    
    Headers:
        Authorization: Bearer <token>
    
    Query Params:
        limit: Número máximo de eventos (default: 100)
        offset: Offset para paginação (default: 0)
        type: Filtrar por tipo de evento (opcional)
    
    Returns:
        JSON com lista de eventos
    """
    try:
        # Verificar token JWT
        auth_header = request.headers.get('Authorization', '')
        
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Token não fornecido'}), 401
        
        token = auth_header.replace('Bearer ', '')
        
        try:
            jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expirado'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token inválido'}), 401
        
        # Parâmetros de consulta
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))
        event_type = request.args.get('type')
        
        # Consultar eventos
        conn = get_db_connection()
        cur = conn.cursor()
        
        if event_type:
            cur.execute("""
                SELECT id, type, data, timestamp
                FROM events
                WHERE type = %s
                ORDER BY id DESC
                LIMIT %s OFFSET %s
            """, (event_type, limit, offset))
        else:
            cur.execute("""
                SELECT id, type, data, timestamp
                FROM events
                ORDER BY id DESC
                LIMIT %s OFFSET %s
            """, (limit, offset))
        
        events = cur.fetchall()
        
        # Contar total
        if event_type:
            cur.execute("SELECT COUNT(*) FROM events WHERE type = %s", (event_type,))
        else:
            cur.execute("SELECT COUNT(*) FROM events")
        
        total = cur.fetchone()[0]
        
        cur.close()
        conn.close()
        
        # Formatar resposta
        events_list = []
        for event in events:
            events_list.append({
                'id': event[0],
                'type': event[1],
                'data': event[2],  # Já é JSON
                'timestamp': event[3].isoformat() if event[3] else None
            })
        
        return jsonify({
            'status': 'success',
            'events': events_list,
            'total': total,
            'limit': limit,
            'offset': offset
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao obter eventos: {str(e)}")
        return jsonify({'error': 'Erro ao obter eventos', 'details': str(e)}), 500

@explorer_bp.route('/contracts', methods=['GET'])
def get_contracts():
    """
    Retorna endereços dos contratos deployados
    
    Returns:
        JSON com endereços dos contratos
    """
    try:
        # Ler configuração dos contratos
        with open('/home/ubuntu/bts-blocktrust/contracts_config.json', 'r') as f:
            config = json.load(f)
        
        return jsonify({
            'status': 'success',
            'contracts': {
                'IdentityNFT': config['IdentityNFT']['address'],
                'ProofRegistry': config['ProofRegistry']['address'],
                'FailSafe': config['FailSafe']['address']
            },
            'network': 'Polygon Mumbai',
            'chainId': 80001
        }), 200
        
    except FileNotFoundError:
        return jsonify({
            'error': 'Contratos não deployados',
            'message': 'Execute o deploy primeiro: npx hardhat run scripts/deploy.js --network polygonMumbai'
        }), 404
        
    except Exception as e:
        logger.error(f"❌ Erro ao obter contratos: {str(e)}")
        return jsonify({'error': 'Erro ao obter contratos', 'details': str(e)}), 500

@explorer_bp.route('/stats', methods=['GET'])
def get_stats():
    """
    Retorna estatísticas dos eventos
    
    Returns:
        JSON com estatísticas
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Total de eventos por tipo
        cur.execute("""
            SELECT type, COUNT(*) as count
            FROM events
            GROUP BY type
            ORDER BY count DESC
        """)
        
        events_by_type = {}
        for row in cur.fetchall():
            events_by_type[row[0]] = row[1]
        
        # Total geral
        cur.execute("SELECT COUNT(*) FROM events")
        total_events = cur.fetchone()[0]
        
        # Eventos nas últimas 24h
        cur.execute("""
            SELECT COUNT(*) FROM events
            WHERE timestamp > NOW() - INTERVAL '24 hours'
        """)
        events_24h = cur.fetchone()[0]
        
        # Último evento
        cur.execute("""
            SELECT type, timestamp FROM events
            ORDER BY id DESC LIMIT 1
        """)
        
        last_event = cur.fetchone()
        last_event_data = None
        if last_event:
            last_event_data = {
                'type': last_event[0],
                'timestamp': last_event[1].isoformat() if last_event[1] else None
            }
        
        cur.close()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'stats': {
                'total_events': total_events,
                'events_24h': events_24h,
                'events_by_type': events_by_type,
                'last_event': last_event_data
            }
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao obter estatísticas: {str(e)}")
        return jsonify({'error': 'Erro ao obter estatísticas', 'details': str(e)}), 500



@explorer_bp.route('/dual-proofs', methods=['GET'])
def get_dual_proofs():
    """
    Retorna lista de assinaturas duplas (Dual Proofs)
    
    Returns:
        {
            "proofs": [
                {
                    "id": 1,
                    "doc_hash": "0x...",
                    "pgp_fingerprint": "...",
                    "pgp_sig_hash": "0x...",
                    "nft_id": 123,
                    "blockchain_tx": "0x...",
                    "created_at": "2025-10-28T...",
                    "user_email": "user@example.com"
                }
            ],
            "total": 10
        }
    """
    try:
        from ..database import get_db_connection
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Obter parâmetros de paginação
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        offset = (page - 1) * per_page
        
        # Contar total
        cur.execute("SELECT COUNT(*) FROM dual_sign_logs")
        total = cur.fetchone()[0]
        
        # Buscar proofs
        cur.execute("""
            SELECT 
                dsl.id,
                dsl.doc_hash,
                dsl.pgp_fingerprint,
                dsl.pgp_sig_hash,
                dsl.nft_id,
                dsl.blockchain_tx,
                dsl.created_at,
                u.email
            FROM dual_sign_logs dsl
            LEFT JOIN users u ON dsl.user_id = u.id
            ORDER BY dsl.created_at DESC
            LIMIT %s OFFSET %s
        """, (per_page, offset))
        
        proofs = []
        for row in cur.fetchall():
            proofs.append({
                'id': row[0],
                'doc_hash': row[1],
                'pgp_fingerprint': row[2],
                'pgp_sig_hash': row[3],
                'nft_id': row[4],
                'blockchain_tx': row[5],
                'created_at': row[6].isoformat() if row[6] else None,
                'user_email': row[7]
            })
        
        cur.close()
        conn.close()
        
        return jsonify({
            'proofs': proofs,
            'total': total,
            'page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao obter dual proofs: {str(e)}")
        return jsonify({'error': str(e)}), 500

