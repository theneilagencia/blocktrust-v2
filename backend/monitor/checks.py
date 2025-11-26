"""
Health Checks - Blocktrust v1.2
Verifica status da API, eventos e listener
"""

import time
import requests
import os
import logging
from .client import get_token, get, API_BASE
from .db import save_metric
from .alerts import alert

logger = logging.getLogger(__name__)

SLO_LATENCY_MS = int(os.getenv("SLO_LATENCY_MS", "800"))

def check_http_health():
    """
    Verifica endpoint /api/health
    """
    t0 = time.time()
    
    try:
        response = requests.get(f"{API_BASE}/api/health", timeout=10)
        ok = (response.status_code == 200)
        latency_ms = int((time.time() - t0) * 1000)
        
        details = {
            "status_code": response.status_code,
            "response": response.json() if ok else None
        }
        
        save_metric("api.health", ok, latency_ms, details)
        
        # Verificar SLO
        if not ok:
            alert(
                "API /health indisponível",
                f"Status code: {response.status_code}",
                "crit"
            )
        elif latency_ms > SLO_LATENCY_MS:
            alert(
                "API /health fora do SLO",
                f"Latência: {latency_ms}ms (SLO: {SLO_LATENCY_MS}ms)",
                "warn"
            )
        else:
            logger.info(f"✅ API /health OK | {latency_ms}ms")
        
    except Exception as e:
        latency_ms = int((time.time() - t0) * 1000)
        save_metric("api.health", False, latency_ms, {"error": str(e)})
        alert(
            "API /health indisponível",
            f"Erro: {str(e)}",
            "crit"
        )
        logger.error(f"❌ API /health falhou: {str(e)}")

def check_events_snapshot():
    """
    Verifica endpoint /api/explorer/events
    """
    try:
        token = get_token()
        t0 = time.time()
        
        response = get("/api/explorer/events", token)
        ok = (response.status_code == 200)
        latency_ms = int((time.time() - t0) * 1000)
        
        if ok:
            data = response.json()
            event_count = len(data.get('events', []))
            details = {"event_count": event_count}
        else:
            details = {"status_code": response.status_code}
            event_count = 0
        
        save_metric("api.events", ok, latency_ms, details)
        
        # Verificar SLO
        if not ok:
            alert(
                "API /events indisponível",
                f"Status code: {response.status_code}",
                "crit"
            )
        elif latency_ms > SLO_LATENCY_MS:
            alert(
                "API /events fora do SLO",
                f"Latência: {latency_ms}ms (SLO: {SLO_LATENCY_MS}ms)",
                "warn"
            )
        else:
            logger.info(f"✅ API /events OK | {event_count} eventos | {latency_ms}ms")
        
    except Exception as e:
        latency_ms = int((time.time() - t0) * 1000) if 't0' in locals() else 0
        save_metric("api.events", False, latency_ms, {"error": str(e)})
        alert(
            "API /events indisponível",
            f"Erro: {str(e)}",
            "crit"
        )
        logger.error(f"❌ API /events falhou: {str(e)}")

def check_contracts():
    """
    Verifica endpoint /api/explorer/contracts
    """
    t0 = time.time()
    
    try:
        response = requests.get(f"{API_BASE}/api/explorer/contracts", timeout=10)
        ok = (response.status_code == 200)
        latency_ms = int((time.time() - t0) * 1000)
        
        if ok:
            data = response.json()
            contracts = data.get('contracts', {})
            details = {
                "contract_count": len(contracts),
                "contracts": contracts
            }
        else:
            details = {"status_code": response.status_code}
        
        save_metric("api.contracts", ok, latency_ms, details)
        
        if not ok:
            alert(
                "API /contracts indisponível",
                f"Status code: {response.status_code}",
                "warn"
            )
        else:
            logger.info(f"✅ API /contracts OK | {len(contracts)} contratos | {latency_ms}ms")
        
    except Exception as e:
        latency_ms = int((time.time() - t0) * 1000)
        save_metric("api.contracts", False, latency_ms, {"error": str(e)})
        logger.error(f"❌ API /contracts falhou: {str(e)}")

def check_stats():
    """
    Verifica endpoint /api/explorer/stats
    """
    t0 = time.time()
    
    try:
        response = requests.get(f"{API_BASE}/api/explorer/stats", timeout=10)
        ok = (response.status_code == 200)
        latency_ms = int((time.time() - t0) * 1000)
        
        if ok:
            data = response.json()
            stats = data.get('stats', {})
            details = {
                "total_events": stats.get('total_events', 0),
                "events_24h": stats.get('events_24h', 0)
            }
        else:
            details = {"status_code": response.status_code}
        
        save_metric("api.stats", ok, latency_ms, details)
        
        if ok:
            logger.info(f"✅ API /stats OK | {stats.get('total_events', 0)} eventos totais | {latency_ms}ms")
        else:
            logger.warning(f"⚠️ API /stats falhou: {response.status_code}")
        
    except Exception as e:
        latency_ms = int((time.time() - t0) * 1000)
        save_metric("api.stats", False, latency_ms, {"error": str(e)})
        logger.error(f"❌ API /stats falhou: {str(e)}")

