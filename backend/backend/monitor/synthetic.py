"""
Testes Sintéticos - Blocktrust v1.2
Simula operações críticas para validar o sistema end-to-end
"""

import os
import time
import hashlib
import logging
from .client import get_token, post, API_BASE
from .db import save_metric
from .alerts import alert

logger = logging.getLogger(__name__)

def synthetic_hash_file():
    """
    Teste sintético: Gerar hash de arquivo
    """
    try:
        token = get_token()
        t0 = time.time()
        
        # Conteúdo sintético
        content = f"synthetic-test-{int(time.time())}"
        
        response = post(
            "/api/signature/hash-file",
            token,
            {"file_content": content}
        )
        
        ok = (response.status_code == 200)
        latency_ms = int((time.time() - t0) * 1000)
        
        if ok:
            data = response.json()
            file_hash = data.get('file_hash', '')
            
            # Verificar se o hash está correto
            expected_hash = hashlib.sha256(content.encode()).hexdigest()
            hash_valid = (file_hash == expected_hash)
            
            details = {
                "file_hash": file_hash,
                "hash_valid": hash_valid
            }
            
            save_metric("synthetic.hash", ok and hash_valid, latency_ms, details)
            
            if hash_valid:
                logger.info(f"✅ Teste sintético hash OK | {latency_ms}ms")
            else:
                alert(
                    "Teste sintético hash falhou",
                    f"Hash inválido: esperado {expected_hash}, recebido {file_hash}",
                    "crit"
                )
        else:
            details = {"status_code": response.status_code}
            save_metric("synthetic.hash", False, latency_ms, details)
            alert(
                "Teste sintético hash falhou",
                f"Status code: {response.status_code}",
                "crit"
            )
        
    except Exception as e:
        latency_ms = int((time.time() - t0) * 1000) if 't0' in locals() else 0
        save_metric("synthetic.hash", False, latency_ms, {"error": str(e)})
        alert(
            "Teste sintético hash indisponível",
            f"Erro: {str(e)}",
            "crit"
        )
        logger.error(f"❌ Teste sintético hash falhou: {str(e)}")

def synthetic_wallet_info():
    """
    Teste sintético: Obter informações da carteira
    """
    try:
        token = get_token()
        t0 = time.time()
        
        # Nota: Este teste requer que o usuário admin tenha uma carteira criada
        from .client import get
        
        response = get("/api/wallet/info", token)
        
        ok = (response.status_code in [200, 404])  # 404 é OK se não tiver carteira
        latency_ms = int((time.time() - t0) * 1000)
        
        if response.status_code == 200:
            data = response.json()
            has_wallet = 'address' in data
            details = {
                "has_wallet": has_wallet,
                "address": data.get('address', '')
            }
        else:
            details = {"status_code": response.status_code}
        
        save_metric("synthetic.wallet_info", ok, latency_ms, details)
        
        if ok:
            logger.info(f"✅ Teste sintético wallet info OK | {latency_ms}ms")
        else:
            alert(
                "Teste sintético wallet info falhou",
                f"Status code: {response.status_code}",
                "warn"
            )
        
    except Exception as e:
        latency_ms = int((time.time() - t0) * 1000) if 't0' in locals() else 0
        save_metric("synthetic.wallet_info", False, latency_ms, {"error": str(e)})
        logger.error(f"❌ Teste sintético wallet info falhou: {str(e)}")

def synthetic_nft_status():
    """
    Teste sintético: Verificar status do NFT
    """
    try:
        token = get_token()
        t0 = time.time()
        
        from .client import get
        
        response = get("/api/nft/status", token)
        
        ok = (response.status_code in [200, 404])  # 404 é OK se não tiver NFT
        latency_ms = int((time.time() - t0) * 1000)
        
        if response.status_code == 200:
            data = response.json()
            has_nft = data.get('has_nft', False)
            details = {
                "has_nft": has_nft,
                "nft_id": data.get('nft_id', 0)
            }
        else:
            details = {"status_code": response.status_code}
        
        save_metric("synthetic.nft_status", ok, latency_ms, details)
        
        if ok:
            logger.info(f"✅ Teste sintético NFT status OK | {latency_ms}ms")
        else:
            alert(
                "Teste sintético NFT status falhou",
                f"Status code: {response.status_code}",
                "warn"
            )
        
    except Exception as e:
        latency_ms = int((time.time() - t0) * 1000) if 't0' in locals() else 0
        save_metric("synthetic.nft_status", False, latency_ms, {"error": str(e)})
        logger.error(f"❌ Teste sintético NFT status falhou: {str(e)}")

