from flask import Blueprint, request, jsonify
from api.auth import token_required
from api.utils.mail import send_panic_email
from api.utils.db import get_db_connection

panic_bp = Blueprint('panic', __name__)

@panic_bp.route('/panic', methods=['POST'])
@token_required
def panic_alert(payload):
    data = request.json
    wallet = data.get('wallet', '')
    doc_hash = data.get('hash', '')
    note = data.get('note', '')
    
    # Salvar alerta no banco
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        'INSERT INTO alerts (user_id, wallet, hash, note) VALUES (%s, %s, %s, %s)',
        (payload['user_id'], wallet, doc_hash, note)
    )
    conn.commit()
    cur.close()
    conn.close()
    
    # Enviar email
    try:
        send_panic_email(payload['email'], wallet, doc_hash, note)
        return jsonify({'message': 'Alerta de pânico registrado e email enviado'}), 200
    except Exception as e:
        return jsonify({'message': 'Alerta registrado, mas falha no envio de email', 'error': str(e)}), 200

