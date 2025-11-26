"""
Sistema de Alertas - Blocktrust v1.2
Envia notificações para Slack e Telegram
"""

import os
import json
import requests
import logging

logger = logging.getLogger(__name__)

SLACK_WEBHOOK = os.getenv("ALERT_SLACK_WEBHOOK")
TELEGRAM_BOT = os.getenv("ALERT_TELEGRAM_BOT")
TELEGRAM_CHAT = os.getenv("ALERT_TELEGRAM_CHAT")

def alert(title, detail, severity="warn"):
    """
    Envia alerta para Slack e/ou Telegram
    
    Args:
        title: Título do alerta
        detail: Detalhes do problema
        severity: Nível de severidade (info, warn, crit)
    """
    # Emoji por severidade
    emoji_map = {
        "info": "ℹ️",
        "warn": "⚠️",
        "crit": "🚨"
    }
    
    emoji = emoji_map.get(severity, "⚠️")
    message = f"{emoji} [{severity.upper()}] {title}\n{detail}"
    
    # Enviar para Slack
    if SLACK_WEBHOOK:
        try:
            response = requests.post(
                SLACK_WEBHOOK,
                json={"text": message},
                timeout=5
            )
            if response.status_code == 200:
                logger.info(f"✅ Alerta enviado para Slack: {title}")
            else:
                logger.error(f"❌ Erro ao enviar para Slack: {response.status_code}")
        except Exception as e:
            logger.error(f"❌ Erro ao enviar para Slack: {str(e)}")
    
    # Enviar para Telegram
    if TELEGRAM_BOT and TELEGRAM_CHAT:
        try:
            response = requests.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT}/sendMessage",
                data={
                    "chat_id": TELEGRAM_CHAT,
                    "text": message
                },
                timeout=5
            )
            if response.status_code == 200:
                logger.info(f"✅ Alerta enviado para Telegram: {title}")
            else:
                logger.error(f"❌ Erro ao enviar para Telegram: {response.status_code}")
        except Exception as e:
            logger.error(f"❌ Erro ao enviar para Telegram: {str(e)}")
    
    # Log local
    logger.warning(f"🚨 ALERTA: {message}")

