from flask import Blueprint, request, jsonify
import bcrypt
import secrets
import string
from api.auth import token_required
from api.utils.db import get_db_connection
from api.utils.email_sender import send_email

user_mgmt_bp = Blueprint('user_management', __name__)

@user_mgmt_bp.route('/me', methods=['GET'])
@token_required
def get_my_profile(current_user):
    """Obtém dados completos do usuário logado incluindo carteira e NFT"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute('''
            SELECT 
                id, 
                email, 
                role, 
                status,
                plan,
                created_at,
                kyc_status,
                wallet_address,
                nft_token_id,
                nft_tx_hash,
                nft_active
            FROM users
            WHERE id = %s
        ''', (current_user.id,))
        
        row = cur.fetchone()
        cur.close()
        conn.close()
        
        if not row:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        return jsonify({
            'id': row['id'],
            'email': row['email'],
            'role': row['role'],
            'status': row['status'] if row.get('status') else 'active',
            'plan': row['plan'] if row.get('plan') else 'free',
            'created_at': row['created_at'].isoformat() if row.get('created_at') else None,
            'kyc_status': row['kyc_status'] if row.get('kyc_status') else 'not_initiated',
            'wallet_address': row['wallet_address'],
            'nft_token_id': row['nft_token_id'],
            'nft_tx_hash': row['nft_tx_hash'],
            'nft_active': row['nft_active'] if row.get('nft_active') else False
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Erro ao buscar perfil: {str(e)}'}), 500

def generate_temp_password(length=12):
    """Gera uma senha temporária segura"""
    characters = string.ascii_letters + string.digits + "!@#$%&*"
    return ''.join(secrets.choice(characters) for _ in range(length))

@user_mgmt_bp.route('/users', methods=['GET'])
@token_required
def list_users(current_user):
    """Lista todos os usuários (apenas admin/superadmin)"""
    if current_user.role not in ['admin', 'superadmin']:
        return jsonify({'error': 'Acesso negado'}), 403
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Buscar todos os usuários com informações relevantes
        cur.execute('''
            SELECT 
                id, 
                email, 
                role, 
                status,
                plan,
                created_at,
                last_login,
                kyc_status
            FROM users
            ORDER BY created_at DESC
        ''')
        
        users = []
        for row in cur.fetchall():
            users.append({
                'id': row[0],
                'email': row[1],
                'role': row[2],
                'status': row[3] if row[3] else 'active',
                'plan': row[4] if row[4] else 'free',
                'created_at': row[5].isoformat() if row[5] else None,
                'last_login': row[6].isoformat() if row[6] else None,
                'kyc_status': row[7] if row[7] else 'not_started'
            })
        
        cur.close()
        conn.close()
        
        return jsonify({'users': users}), 200
        
    except Exception as e:
        return jsonify({'error': f'Erro ao listar usuários: {str(e)}'}), 500

@user_mgmt_bp.route('/users/<int:user_id>', methods=['GET'])
@token_required
def get_user(current_user, user_id):
    """Obtém detalhes de um usuário específico (apenas admin/superadmin)"""
    if current_user.role not in ['admin', 'superadmin']:
        return jsonify({'error': 'Acesso negado'}), 403
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute('''
            SELECT 
                id, 
                email, 
                role, 
                status,
                plan,
                created_at,
                last_login,
                kyc_status,
                applicant_id,
                liveness_status
            FROM users
            WHERE id = %s
        ''', (user_id,))
        
        row = cur.fetchone()
        
        if not row:
            cur.close()
            conn.close()
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        user = {
            'id': row[0],
            'email': row[1],
            'role': row[2],
            'status': row[3] if row[3] else 'active',
            'plan': row[4] if row[4] else 'free',
            'created_at': row[5].isoformat() if row[5] else None,
            'last_login': row[6].isoformat() if row[6] else None,
            'kyc_status': row[7] if row[7] else 'not_started',
            'applicant_id': row[8],
            'liveness_status': row[9]
        }
        
        cur.close()
        conn.close()
        
        return jsonify({'user': user}), 200
        
    except Exception as e:
        return jsonify({'error': f'Erro ao buscar usuário: {str(e)}'}), 500

@user_mgmt_bp.route('/users/<int:user_id>', methods=['PUT'])
@token_required
def update_user(current_user, user_id):
    """Atualiza informações de um usuário (apenas admin/superadmin)"""
    if current_user.role not in ['admin', 'superadmin']:
        return jsonify({'error': 'Acesso negado'}), 403
    
    data = request.json
    
    # Campos permitidos para atualização
    allowed_fields = ['status', 'plan', 'role']
    updates = []
    values = []
    
    for field in allowed_fields:
        if field in data:
            updates.append(f"{field} = %s")
            values.append(data[field])
    
    if not updates:
        return jsonify({'error': 'Nenhum campo válido para atualização'}), 400
    
    # Validações
    if 'status' in data and data['status'] not in ['active', 'inactive']:
        return jsonify({'error': 'Status inválido. Use "active" ou "inactive"'}), 400
    
    if 'plan' in data and data['plan'] not in ['free', 'basic', 'premium', 'enterprise']:
        return jsonify({'error': 'Plano inválido'}), 400
    
    if 'role' in data:
        # Apenas superadmin pode alterar roles
        if current_user.role != 'superadmin':
            return jsonify({'error': 'Apenas superadmin pode alterar roles'}), 403
        
        if data['role'] not in ['user', 'admin', 'superadmin']:
            return jsonify({'error': 'Role inválido'}), 400
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Verificar se usuário existe
        cur.execute('SELECT id FROM users WHERE id = %s', (user_id,))
        if not cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        # Atualizar usuário
        values.append(user_id)
        query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
        cur.execute(query, values)
        conn.commit()
        
        cur.close()
        conn.close()
        
        return jsonify({'message': 'Usuário atualizado com sucesso'}), 200
        
    except Exception as e:
        return jsonify({'error': f'Erro ao atualizar usuário: {str(e)}'}), 500

@user_mgmt_bp.route('/users/<int:user_id>/reset-password', methods=['POST'])
@token_required
def reset_user_password(current_user, user_id):
    """Reseta a senha de um usuário e envia por email (apenas admin/superadmin)"""
    if current_user.role not in ['admin', 'superadmin']:
        return jsonify({'error': 'Acesso negado'}), 403
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Buscar email do usuário
        cur.execute('SELECT email FROM users WHERE id = %s', (user_id,))
        row = cur.fetchone()
        
        if not row:
            cur.close()
            conn.close()
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        user_email = row[0]
        
        # Gerar senha temporária
        temp_password = generate_temp_password()
        
        # Hash da senha temporária
        password_hash = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Atualizar senha e marcar como temporária
        cur.execute('''
            UPDATE users 
            SET password_hash = %s, 
                password_reset_required = TRUE
            WHERE id = %s
        ''', (password_hash, user_id))
        conn.commit()
        
        cur.close()
        conn.close()
        
        # Enviar email com senha temporária
        subject = "BTS Blocktrust - Senha Temporária"
        body = f"""
        <html>
        <body>
            <h2>Senha Temporária - BTS Blocktrust</h2>
            <p>Olá,</p>
            <p>Sua senha foi resetada por um administrador.</p>
            <p><strong>Senha temporária:</strong> {temp_password}</p>
            <p><strong>IMPORTANTE:</strong> Por segurança, você será solicitado a alterar esta senha no primeiro login.</p>
            <p>Acesse: <a href="https://bts-blocktrust.onrender.com/login">https://bts-blocktrust.onrender.com/login</a></p>
            <br>
            <p>Atenciosamente,<br>Equipe BTS Blocktrust</p>
        </body>
        </html>
        """
        
        send_email(user_email, subject, body)
        
        return jsonify({
            'message': 'Senha resetada com sucesso. Email enviado ao usuário.'
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Erro ao resetar senha: {str(e)}'}), 500

@user_mgmt_bp.route('/users/<int:user_id>', methods=['DELETE'])
@token_required
def delete_user(current_user, user_id):
    """Deleta um usuário (apenas superadmin)"""
    if current_user.role != 'superadmin':
        return jsonify({'error': 'Acesso negado. Apenas superadmin pode deletar usuários'}), 403
    
    # Não permitir deletar a si mesmo
    if current_user.id == user_id:
        return jsonify({'error': 'Você não pode deletar sua própria conta'}), 400
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Verificar se usuário existe
        cur.execute('SELECT id FROM users WHERE id = %s', (user_id,))
        if not cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        # Deletar usuário
        cur.execute('DELETE FROM users WHERE id = %s', (user_id,))
        conn.commit()
        
        cur.close()
        conn.close()
        
        return jsonify({'message': 'Usuário deletado com sucesso'}), 200
        
    except Exception as e:
        return jsonify({'error': f'Erro ao deletar usuário: {str(e)}'}), 500

