"""
Módulo para envio de emails
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

logger = logging.getLogger(__name__)

def send_email(to_email, subject, body_html):
    """
    Envia um email usando SMTP
    
    Args:
        to_email: Email do destinatário
        subject: Assunto do email
        body_html: Corpo do email em HTML
    
    Returns:
        True se enviado com sucesso, False caso contrário
    """
    try:
        # Configurações SMTP (variáveis de ambiente)
        smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        smtp_user = os.getenv('SMTP_USER')
        smtp_password = os.getenv('SMTP_PASSWORD')
        from_email = os.getenv('SMTP_FROM_EMAIL', smtp_user)
        
        if not smtp_user or not smtp_password:
            logger.warning("⚠️ SMTP não configurado. Email não será enviado.")
            logger.info(f"📧 Email que seria enviado para {to_email}:")
            logger.info(f"   Assunto: {subject}")
            logger.info(f"   Corpo: {body_html[:200]}...")
            return False
        
        # Criar mensagem
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = from_email
        msg['To'] = to_email
        
        # Adicionar corpo HTML
        html_part = MIMEText(body_html, 'html')
        msg.attach(html_part)
        
        # Conectar ao servidor SMTP
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        
        # Enviar email
        server.send_message(msg)
        server.quit()
        
        logger.info(f"✅ Email enviado com sucesso para {to_email}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Erro ao enviar email para {to_email}: {str(e)}")
        return False

