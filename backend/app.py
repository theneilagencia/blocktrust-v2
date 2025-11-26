from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Carregar variáveis de ambiente do .env
load_dotenv()

# Import routes
from api.routes.auth_routes import auth_bp
# from api.routes.proxy_routes import proxy_bp  # DEPRECATED - Toolblox removido na v1.4
from api.routes.panic_routes import panic_bp
from api.routes.kyc_routes import kyc_bp
from api.routes.admin_routes import admin_bp
from api.routes.wallet_routes import wallet_bp
from api.routes.nft_routes import nft_bp
from api.routes.signature_routes import signature_bp
from api.routes.explorer_routes import explorer_bp
from api.routes.pgp_routes import pgp_bp, dual_bp
from api.routes.failsafe_routes import failsafe_bp
from api.routes.document_routes import document_bp
from api.routes.user_management_routes import user_mgmt_bp
from api.routes.mfa_routes import mfa_bp
from api.routes.push import push_bp

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
# app.register_blueprint(proxy_bp, url_prefix='/api/proxy')  # DEPRECATED
app.register_blueprint(panic_bp, url_prefix='/api/panic')
app.register_blueprint(kyc_bp, url_prefix='/api/kyc')
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(wallet_bp, url_prefix='/api/wallet')
app.register_blueprint(nft_bp, url_prefix='/api/nft')
app.register_blueprint(signature_bp, url_prefix='/api/signature')
app.register_blueprint(explorer_bp, url_prefix='/api/explorer')
app.register_blueprint(pgp_bp)
app.register_blueprint(dual_bp)
app.register_blueprint(failsafe_bp, url_prefix='/api/failsafe')
app.register_blueprint(document_bp, url_prefix='/api/document')
app.register_blueprint(user_mgmt_bp, url_prefix='/api/admin')
app.register_blueprint(mfa_bp, url_prefix='/api/mfa')
app.register_blueprint(push_bp)

# Health check
@app.route('/api/health')
def health():
    return {'service': 'BTS Blocktrust API', 'status': 'ok'}

# Database health check
@app.route('/api/db/health', methods=['GET'])
def db_health():
    from api.utils.db_engine import engine
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {'success': True, 'message': 'DB connection OK'}, 200
    except Exception as e:
        return {'success': False, 'error': str(e)}, 500

# Init database endpoint
@app.route('/api/init-db', methods=['POST'])
def init_database():
    from api.utils.db import init_db
    try:
        db_url = os.getenv('DATABASE_URL')
        if not db_url:
            return {'status': 'error', 'message': 'DATABASE_URL not set', 'db_url_set': False}, 500
        
        init_db()
        return {
            'status': 'success',
            'message': 'Database initialized successfully',
            'db_url_set': True,
            'host': db_url.split('@')[1].split('/')[0] if '@' in db_url else 'unknown'
        }
    except Exception as e:
        return {
            'status': 'error',
            'message': str(e),
            'db_url_set': bool(os.getenv('DATABASE_URL'))
        }, 500

# Serve frontend
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

# Handle 404 errors - serve index.html for React Router
@app.errorhandler(404)
def not_found(e):
    # Se a rota começa com /api, retorna JSON
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Not found'}), 404
    # Caso contrário, serve o index.html (React Router)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    port = int(os.getenv('PORT', 10000))
    app.run(host='0.0.0.0', port=port)


@app.route('/api/migrate/kyc', methods=['POST'])
def migrate_kyc():
    """Endpoint para executar migration de KYC"""
    try:
        from migrate_kyc import migrate_kyc_columns
        migrate_kyc_columns()
        return jsonify({'message': 'Migration executada com sucesso'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
