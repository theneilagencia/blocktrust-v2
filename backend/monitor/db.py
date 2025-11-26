"""
Banco de Dados para Métricas - Blocktrust v1.2
"""

import os
import psycopg2
import json
import logging

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")

def get_connection():
    """Cria conexão com o banco de dados"""
    return psycopg2.connect(DATABASE_URL)

def init_tables():
    """Cria tabelas de monitoramento se não existirem"""
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        # Tabela de métricas
        cur.execute("""
            CREATE TABLE IF NOT EXISTS monitor_metrics(
                id SERIAL PRIMARY KEY,
                ts TIMESTAMP DEFAULT NOW(),
                check_name TEXT,
                ok BOOLEAN,
                latency_ms INT,
                details JSONB
            )
        """)
        
        # Tabela de incidentes
        cur.execute("""
            CREATE TABLE IF NOT EXISTS monitor_incidents(
                id SERIAL PRIMARY KEY,
                opened_at TIMESTAMP DEFAULT NOW(),
                resolved_at TIMESTAMP,
                severity TEXT,
                title TEXT,
                detail TEXT
            )
        """)
        
        # Índices para performance
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_monitor_metrics_ts 
            ON monitor_metrics(ts DESC)
        """)
        
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_monitor_metrics_check_name 
            ON monitor_metrics(check_name)
        """)
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info("✅ Tabelas de monitoramento inicializadas")
        
    except Exception as e:
        logger.error(f"❌ Erro ao inicializar tabelas: {str(e)}")
        raise

def save_metric(check_name, ok, latency_ms, details):
    """
    Salva métrica no banco de dados
    
    Args:
        check_name: Nome do check (ex: api.health)
        ok: Se o check passou (True/False)
        latency_ms: Latência em milissegundos
        details: Detalhes adicionais (dict)
    """
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO monitor_metrics(check_name, ok, latency_ms, details)
            VALUES (%s, %s, %s, %s)
        """, (check_name, ok, latency_ms, json.dumps(details)))
        
        conn.commit()
        cur.close()
        conn.close()
        
        status = "✅" if ok else "❌"
        logger.debug(f"{status} Métrica salva: {check_name} | {latency_ms}ms")
        
    except Exception as e:
        logger.error(f"❌ Erro ao salvar métrica: {str(e)}")

def save_incident(severity, title, detail):
    """
    Registra um incidente
    
    Args:
        severity: Nível de severidade (info, warn, crit)
        title: Título do incidente
        detail: Detalhes do incidente
    """
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO monitor_incidents(severity, title, detail)
            VALUES (%s, %s, %s)
        """, (severity, title, detail))
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"🚨 Incidente registrado: {title}")
        
    except Exception as e:
        logger.error(f"❌ Erro ao registrar incidente: {str(e)}")

def get_uptime(check_name, hours=24):
    """
    Calcula uptime de um check nas últimas N horas
    
    Args:
        check_name: Nome do check
        hours: Número de horas para calcular
    
    Returns:
        float: Percentual de uptime (0-100)
    """
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT 
                COUNT(*) FILTER (WHERE ok = TRUE) * 100.0 / COUNT(*) as uptime
            FROM monitor_metrics
            WHERE check_name = %s
            AND ts > NOW() - INTERVAL '%s hours'
        """, (check_name, hours))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        return result[0] if result and result[0] else 0.0
        
    except Exception as e:
        logger.error(f"❌ Erro ao calcular uptime: {str(e)}")
        return 0.0

def get_latency_p99(check_name, hours=24):
    """
    Calcula percentil 99 de latência de um check
    
    Args:
        check_name: Nome do check
        hours: Número de horas para calcular
    
    Returns:
        int: Latência P99 em milissegundos
    """
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99
            FROM monitor_metrics
            WHERE check_name = %s
            AND ts > NOW() - INTERVAL '%s hours'
            AND ok = TRUE
        """, (check_name, hours))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        return int(result[0]) if result and result[0] else 0
        
    except Exception as e:
        logger.error(f"❌ Erro ao calcular P99: {str(e)}")
        return 0

