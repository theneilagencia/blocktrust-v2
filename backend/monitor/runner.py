"""
Runner Principal do Monitoramento - Blocktrust v1.2
Executa todos os checks a cada 60 segundos
"""

import time
import logging
import os
from .db import init_tables, get_uptime, get_latency_p99
from .checks import check_http_health, check_events_snapshot, check_contracts, check_stats
from .listener_lag import check_listener_lag, check_listener_progress
from .synthetic import synthetic_hash_file, synthetic_wallet_info, synthetic_nft_status

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

CHECK_INTERVAL = int(os.getenv("MONITOR_CHECK_INTERVAL", "60"))  # segundos
SLO_UPTIME_TARGET = float(os.getenv("SLO_UPTIME_TARGET", "99.5"))
SLO_LATENCY_MS = int(os.getenv("SLO_LATENCY_MS", "800"))

def run_all_checks():
    """Executa todos os health checks"""
    logger.info("🔍 Iniciando ciclo de monitoramento...")
    
    # Health checks da API
    check_http_health()
    check_events_snapshot()
    check_contracts()
    check_stats()
    
    # Monitor do listener
    check_listener_lag()
    check_listener_progress()
    
    # Testes sintéticos
    synthetic_hash_file()
    synthetic_wallet_info()
    synthetic_nft_status()
    
    logger.info("✅ Ciclo de monitoramento concluído")

def print_slo_report():
    """Imprime relatório de SLO"""
    logger.info("\n" + "=" * 60)
    logger.info("📊 RELATÓRIO DE SLO (24 horas)")
    logger.info("=" * 60)
    
    checks = [
        "api.health",
        "api.events",
        "api.contracts",
        "listener.lag"
    ]
    
    for check_name in checks:
        uptime = get_uptime(check_name, 24)
        p99 = get_latency_p99(check_name, 24)
        
        uptime_status = "✅" if uptime >= SLO_UPTIME_TARGET else "❌"
        p99_status = "✅" if p99 <= SLO_LATENCY_MS else "❌"
        
        logger.info(f"\n{check_name}:")
        logger.info(f"  Uptime: {uptime:.2f}% {uptime_status} (SLO: {SLO_UPTIME_TARGET}%)")
        logger.info(f"  P99 Latency: {p99}ms {p99_status} (SLO: {SLO_LATENCY_MS}ms)")
    
    logger.info("=" * 60 + "\n")

def main():
    """Loop principal do monitoramento"""
    logger.info("=" * 60)
    logger.info("🎯 BLOCKTRUST MONITORING SYSTEM v1.2")
    logger.info("=" * 60)
    logger.info(f"Check Interval: {CHECK_INTERVAL}s")
    logger.info(f"SLO Uptime Target: {SLO_UPTIME_TARGET}%")
    logger.info(f"SLO Latency Target: {SLO_LATENCY_MS}ms")
    logger.info("=" * 60 + "\n")
    
    # Inicializar tabelas
    try:
        init_tables()
    except Exception as e:
        logger.error(f"❌ Erro ao inicializar tabelas: {str(e)}")
        logger.error("Verifique a variável DATABASE_URL e tente novamente")
        return
    
    cycle_count = 0
    
    try:
        while True:
            cycle_count += 1
            logger.info(f"\n🔄 Ciclo #{cycle_count}")
            
            try:
                run_all_checks()
            except Exception as e:
                logger.error(f"❌ Erro no ciclo de monitoramento: {str(e)}")
            
            # A cada 12 ciclos (12 minutos), imprimir relatório de SLO
            if cycle_count % 12 == 0:
                try:
                    print_slo_report()
                except Exception as e:
                    logger.error(f"❌ Erro ao gerar relatório de SLO: {str(e)}")
            
            logger.info(f"⏳ Aguardando {CHECK_INTERVAL}s até o próximo ciclo...\n")
            time.sleep(CHECK_INTERVAL)
            
    except KeyboardInterrupt:
        logger.info("\n🛑 Monitoramento interrompido pelo usuário")
    except Exception as e:
        logger.error(f"❌ Erro fatal no monitoramento: {str(e)}")

if __name__ == "__main__":
    main()

