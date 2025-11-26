import os
from datetime import datetime
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY')
FROM_EMAIL = os.getenv('FROM_EMAIL', 'help@btsglobalcorp.com')
ALERT_EMAILS = os.getenv('ALERT_EMAILS', 'help@btsglobalcorp.com').split(',')

def send_panic_email(user_email, wallet, doc_hash, note):
    """Envia email de alerta de pânico"""
    message = Mail(
        from_email=FROM_EMAIL,
        to_emails=ALERT_EMAILS,
        subject='🚨 ALERTA DE PÂNICO - BTS Blocktrust',
        html_content=f'''
        <h2>Alerta de Pânico Registrado</h2>
        <p><strong>Usuário:</strong> {user_email}</p>
        <p><strong>Wallet:</strong> {wallet}</p>
        <p><strong>Hash do Documento:</strong> {doc_hash}</p>
        <p><strong>Nota:</strong> {note}</p>
        <p><strong>Data/Hora:</strong> {datetime.utcnow().isoformat()}</p>
        <hr>
        <p>Este é um alerta automático do sistema BTS Blocktrust.</p>
        '''
    )
    
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        return response.status_code == 202
    except Exception as e:
        print(f'Erro ao enviar email: {e}')
        raise

def send_confirmation_email(to_email, subject, content):
    """Envia email de confirmação genérico"""
    message = Mail(
        from_email=FROM_EMAIL,
        to_emails=to_email,
        subject=subject,
        html_content=content
    )
    
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        return response.status_code == 202
    except Exception as e:
        print(f'Erro ao enviar email: {e}')
        raise

