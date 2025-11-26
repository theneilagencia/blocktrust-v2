"""
Monitor de Lag do Listener - Blocktrust v1.2
Verifica se o listener está processando eventos em tempo hábil
"""

import os
import psycopg2
import logging
from .db import save_metric, get_connection
from .alerts import alert

logger = logging.getLogger(__name__)

MAX_LAG_SEC = int(os.getenv("MAX_LISTENER_LAG_SEC", "180"))  # 3 minutos

def check_listener_lag():
    """
    Verifica o atraso do listener baseado no último heartbeat
    """
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        # Obter último heartbeat do listener
        cur.execute("""
            SELECT EXTRACT(EPOCH FROM (NOW() - MAX(ts))) as lag_sec
            FROM monitor_metrics
            WHERE check_name = 'listener.tick'
        """)
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if result and result[0] is not None:
            lag_sec = int(result[0])
        else:
            # Nenhum heartbeat encontrado
            lag_sec = 999999
        
        ok = (lag_sec < MAX_LAG_SEC)
        
        details = {
            "lag_sec": lag_sec,
            "max_lag_sec": MAX_LAG_SEC
        }
        
        save_metric("listener.lag", ok, lag_sec * 1000, details)
        
        if not ok:
            alert(
                "Listener atrasado ou parado",
                f"Último heartbeat há {lag_sec}s (máximo: {MAX_LAG_SEC}s)",
                "crit"
            )
            logger.error(f"❌ Listener atrasado: {lag_sec}s")
        else:
            logger.info(f"✅ Listener OK | Lag: {lag_sec}s")
        
    except Exception as e:
        save_metric("listener.lag", False, 0, {"error": str(e)})
        alert(
            "Erro ao verificar lag do listener",
            f"Erro: {str(e)}",
            "crit"
        )
        logger.error(f"❌ Erro ao verificar listener lag: {str(e)}")

def check_listener_progress():
    """
    Verifica se o listener está progredindo (processando novos blocos)
    """
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        # Obter últimos 2 heartbeats
        cur.execute("""
            SELECT details->>'block_number' as block_number
            FROM monitor_metrics
            WHERE check_name = 'listener.tick'
            AND details ? 'block_number'
            ORDER BY ts DESC
            LIMIT 2
        """)
        
        results = cur.fetchall()
        cur.close()
        conn.close()
        
        if len(results) >= 2:
            current_block = int(results[0][0])
            previous_block = int(results[1][0])
            
            is_progressing = (current_block > previous_block)
            
            details = {
                "current_block": current_block,
                "previous_block": previous_block,
                "progress": current_block - previous_block
            }
            
            save_metric("listener.progress", is_progressing, 0, details)
            
            if not is_progressing:
                alert(
                    "Listener não está progredindo",
                    f"Bloco atual: {current_block} | Bloco anterior: {previous_block}",
                    "warn"
                )
                logger.warning(f"⚠️ Listener não progrediu: {current_block} == {previous_block}")
            else:
                logger.info(f"✅ Listener progredindo | Bloco: {current_block}")
        else:
            logger.debug("⏳ Aguardando mais dados para verificar progresso do listener")
        
    except Exception as e:
        logger.error(f"❌ Erro ao verificar progresso do listener: {str(e)}")

