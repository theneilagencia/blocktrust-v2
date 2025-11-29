"""
Backend Service para Push Notifications PWA
Implementa Web Push Protocol com VAPID
"""

from flask import Blueprint, request, jsonify
from pywebpush import webpush, WebPushException
from api.auth import token_required
from api.utils.db import get_db_connection
import os
import json
from datetime import datetime
from typing import Dict, Any

push_bp = Blueprint('push', __name__)

# VAPID Keys (deve vir do .env)
VAPID_PRIVATE_KEY = os.getenv('VAPID_PRIVATE_KEY')
VAPID_PUBLIC_KEY = os.getenv('VAPID_PUBLIC_KEY')
VAPID_CLAIMS = {
    "sub": "mailto:support@blocktrust.com"
}


@push_bp.route('/api/push/vapid-public-key', methods=['GET'])
def get_vapid_public_key():
    """
    Retorna a chave pública VAPID para o cliente
    """
    if not VAPID_PUBLIC_KEY:
        return jsonify({'error': 'VAPID keys não configuradas'}), 500
    
    return jsonify({
        'publicKey': VAPID_PUBLIC_KEY
    })


@push_bp.route('/api/push/subscribe', methods=['POST'])
@token_required
def subscribe(current_user):
    """
    Salva subscription do cliente com autenticação
    """
    try:
        data = request.get_json()
        
        if not data or 'subscription' not in data:
            return jsonify({'error': 'Subscription inválida'}), 400
        
        subscription = data['subscription']
        user_id = current_user.id
        
        # Salvar subscription
        subscriptions_store[user_id] = subscription
        
        # Em produção, salvar no banco de dados
        # await db.push_subscriptions.insert_one({
        #     'user_id': user_id,
        #     'subscription': subscription,
        #     'active': True,
        #     'created_at': datetime.now()
        # })
        
        return jsonify({
            'success': True,
            'message': 'Subscription salva com sucesso'
        })
        
    except Exception as e:
        print(f'Erro ao salvar subscription: {e}')
        return jsonify({'error': str(e)}), 500


@push_bp.route('/api/push/unsubscribe', methods=['POST'])
def unsubscribe():
    """
    Remove subscription do cliente
    """
    try:
        data = request.get_json()
        
        if not data or 'endpoint' not in data:
            return jsonify({'error': 'Endpoint inválido'}), 400
        
        endpoint = data['endpoint']
        user_id = request.headers.get('X-User-Id', 'anonymous')
        
        # Remover subscription
        if user_id in subscriptions_store:
            del subscriptions_store[user_id]
        
        return jsonify({
            'success': True,
            'message': 'Subscription removida com sucesso'
        })
        
    except Exception as e:
        print(f'Erro ao remover subscription: {e}')
        return jsonify({'error': str(e)}), 500


@push_bp.route('/api/push/send', methods=['POST'])
def send_notification():
    """
    Envia push notification para um usuário
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dados inválidos'}), 400
        
        user_id = data.get('user_id')
        notification_data = data.get('notification', {})
        
        if not user_id or user_id not in subscriptions_store:
            return jsonify({'error': 'Subscription não encontrada'}), 404
        
        subscription = subscriptions_store[user_id]
        
        # Enviar notificação
        try:
            response = webpush(
                subscription_info=subscription,
                data=json.dumps(notification_data),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS
            )
            
            return jsonify({
                'success': True,
                'message': 'Notificação enviada',
                'status_code': response.status_code
            })
            
        except WebPushException as e:
            print(f'Erro ao enviar push: {e}')
            
            # Se subscription expirou, remover
            if e.response.status_code == 410:
                del subscriptions_store[user_id]
            
            return jsonify({
                'error': 'Falha ao enviar notificação',
                'details': str(e)
            }), 500
        
    except Exception as e:
        print(f'Erro no envio de notificação: {e}')
        return jsonify({'error': str(e)}), 500


def send_transaction_notification(user_id: str, tx_hash: str, amount: str):
    """
    Helper para enviar notificação de transação
    """
    notification = {
        'title': 'Transação Confirmada na Polygon! ✅',
        'body': f'Sua transação de {amount} MATIC foi confirmada',
        'icon': '/icons/icon-192x192.png',
        'badge': '/icons/badge-72x72.png',
        'tag': f'tx-{tx_hash}',
        'data': {
            'url': f'https://amoy.polygonscan.com/tx/{tx_hash}',
            'txHash': tx_hash
        },
        'actions': [
            {'action': 'view', 'title': 'Ver Detalhes'},
            {'action': 'share', 'title': 'Compartilhar'}
        ]
    }
    
    if user_id not in subscriptions_store:
        return False
    
    try:
        webpush(
            subscription_info=subscriptions_store[user_id],
            data=json.dumps(notification),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS
        )
        return True
    except WebPushException as e:
        print(f'Erro ao enviar notificação de transação: {e}')
        if e.response.status_code == 410:
            del subscriptions_store[user_id]
        return False


def send_document_signed_notification(user_id: str, document_id: str, signer_name: str):
    """
    Helper para enviar notificação de documento assinado
    """
    notification = {
        'title': 'Documento Assinado! 📝',
        'body': f'{signer_name} assinou seu documento',
        'icon': '/icons/icon-192x192.png',
        'badge': '/icons/badge-72x72.png',
        'tag': f'doc-{document_id}',
        'data': {
            'url': f'/documents/{document_id}',
            'documentId': document_id
        },
        'actions': [
            {'action': 'view', 'title': 'Ver Documento'}
        ]
    }
    
    if user_id not in subscriptions_store:
        return False
    
    try:
        webpush(
            subscription_info=subscriptions_store[user_id],
            data=json.dumps(notification),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS
        )
        return True
    except WebPushException as e:
        print(f'Erro ao enviar notificação de documento: {e}')
        if e.response.status_code == 410:
            del subscriptions_store[user_id]
        return False


def send_identity_verified_notification(user_id: str):
    """
    Helper para enviar notificação de identidade verificada
    """
    notification = {
        'title': 'Identidade Verificada! 🎉',
        'body': 'Seu NFT de identidade foi criado na blockchain Polygon',
        'icon': '/icons/icon-192x192.png',
        'badge': '/icons/badge-72x72.png',
        'tag': 'identity-verified',
        'data': {
            'url': '/identity'
        },
        'requireInteraction': True
    }
    
    if user_id not in subscriptions_store:
        return False
    
    try:
        webpush(
            subscription_info=subscriptions_store[user_id],
            data=json.dumps(notification),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS
        )
        return True
    except WebPushException as e:
        print(f'Erro ao enviar notificação de identidade: {e}')
        if e.response.status_code == 410:
            del subscriptions_store[user_id]
        return False
