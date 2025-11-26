"""
Listener de Eventos Blockchain - Blocktrust v1.2
Monitora eventos dos contratos e salva no banco de dados
"""

import os
import json
import time
import logging
from web3 import Web3
# geth_poa_middleware não é mais necessário no web3.py >= 6.0
import psycopg2
from psycopg2.extras import Json

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configurações
POLYGON_RPC_URL = os.getenv('POLYGON_RPC_URL', 'https://rpc-mumbai.maticvigil.com')
DATABASE_URL = os.getenv('DATABASE_URL')
POLL_INTERVAL = int(os.getenv('LISTENER_POLL_INTERVAL', '15'))  # segundos

# Conectar ao Web3
w3 = Web3(Web3.HTTPProvider(POLYGON_RPC_URL))
# POA middleware não é mais necessário no web3.py >= 6.0

if not w3.is_connected():
    logger.error("❌ Não foi possível conectar ao Polygon Mumbai")
    exit(1)

logger.info(f"✅ Conectado ao Polygon Mumbai: {POLYGON_RPC_URL}")

# Carregar configuração dos contratos
try:
    with open('/home/ubuntu/bts-blocktrust/contracts_config.json', 'r') as f:
        contracts_config = json.load(f)
    logger.info("✅ Configuração dos contratos carregada")
except FileNotFoundError:
    logger.error("❌ Arquivo contracts_config.json não encontrado!")
    logger.info("Execute o deploy dos contratos primeiro: npx hardhat run scripts/deploy.js --network polygonMumbai")
    exit(1)

# Inicializar contratos
identity_nft = w3.eth.contract(
    address=Web3.to_checksum_address(contracts_config['IdentityNFT']['address']),
    abi=contracts_config['IdentityNFT']['abi']
)

proof_registry = w3.eth.contract(
    address=Web3.to_checksum_address(contracts_config['ProofRegistry']['address']),
    abi=contracts_config['ProofRegistry']['abi']
)

failsafe = w3.eth.contract(
    address=Web3.to_checksum_address(contracts_config['FailSafe']['address']),
    abi=contracts_config['FailSafe']['abi']
)

logger.info(f"✅ Contratos inicializados:")
logger.info(f"  IdentityNFT:   {contracts_config['IdentityNFT']['address']}")
logger.info(f"  ProofRegistry: {contracts_config['ProofRegistry']['address']}")
logger.info(f"  FailSafe:      {contracts_config['FailSafe']['address']}")

def get_db_connection():
    """Cria conexão com o banco de dados"""
    return psycopg2.connect(DATABASE_URL)

def save_event(event_type, event_data):
    """Salva evento no banco de dados"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO events (type, data, timestamp)
            VALUES (%s, %s, NOW())
        """, (event_type, Json(event_data)))
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"✅ Evento salvo: {event_type}")
        
    except Exception as e:
        logger.error(f"❌ Erro ao salvar evento: {str(e)}")

def process_event(event, event_type):
    """Processa um evento e extrai dados relevantes"""
    try:
        event_data = {
            'blockNumber': event['blockNumber'],
            'transactionHash': event['transactionHash'].hex(),
            'address': event['address'],
            'args': {}
        }
        
        # Extrair argumentos do evento
        for key, value in event['args'].items():
            if isinstance(value, bytes):
                event_data['args'][key] = value.hex()
            else:
                event_data['args'][key] = str(value)
        
        save_event(event_type, event_data)
        
    except Exception as e:
        logger.error(f"❌ Erro ao processar evento {event_type}: {str(e)}")

def listen_events():
    """Loop principal que escuta eventos da blockchain"""
    logger.info("🎧 Iniciando listener de eventos...")
    
    # Obter último bloco processado do banco
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Criar tabela de eventos se não existir
        cur.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                type VARCHAR(50) NOT NULL,
                data JSONB NOT NULL,
                timestamp TIMESTAMP DEFAULT NOW()
            )
        """)
        
        # Criar índices
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
            CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
        """)
        
        conn.commit()
        
        # Obter último bloco processado
        cur.execute("SELECT MAX((data->>'blockNumber')::INTEGER) FROM events")
        result = cur.fetchone()
        last_block = result[0] if result[0] else w3.eth.block_number - 100
        
        cur.close()
        conn.close()
        
        logger.info(f"📍 Último bloco processado: {last_block}")
        
    except Exception as e:
        logger.error(f"❌ Erro ao inicializar banco: {str(e)}")
        last_block = w3.eth.block_number - 100
    
    current_block = last_block
    
    while True:
        try:
            latest_block = w3.eth.block_number
            
            if current_block < latest_block:
                logger.info(f"🔍 Processando blocos {current_block} até {latest_block}...")
                
                # Eventos do IdentityNFT
                try:
                    # MintingEvent
                    minting_events = identity_nft.events.MintingEvent().get_logs(
                        fromBlock=current_block,
                        toBlock=latest_block
                    )
                    for event in minting_events:
                        process_event(event, 'Minted')
                    
                    # CancelamentoEvent
                    cancel_events = identity_nft.events.CancelamentoEvent().get_logs(
                        fromBlock=current_block,
                        toBlock=latest_block
                    )
                    for event in cancel_events:
                        process_event(event, 'Canceled')
                    
                    # CancelamentoSimples
                    cancel_simple_events = identity_nft.events.CancelamentoSimples().get_logs(
                        fromBlock=current_block,
                        toBlock=latest_block
                    )
                    for event in cancel_simple_events:
                        process_event(event, 'CanceledSimple')
                        
                except Exception as e:
                    logger.error(f"❌ Erro ao processar eventos IdentityNFT: {str(e)}")
                
                # Eventos do ProofRegistry
                try:
                    proof_events = proof_registry.events.ProofRegistered().get_logs(
                        fromBlock=current_block,
                        toBlock=latest_block
                    )
                    for event in proof_events:
                        process_event(event, 'ProofStored')
                    
                    revoke_events = proof_registry.events.ProofRevoked().get_logs(
                        fromBlock=current_block,
                        toBlock=latest_block
                    )
                    for event in revoke_events:
                        process_event(event, 'ProofRevoked')
                        
                except Exception as e:
                    logger.error(f"❌ Erro ao processar eventos ProofRegistry: {str(e)}")
                
                # Eventos do FailSafe
                try:
                    failsafe_events = failsafe.events.FailsafeEvent().get_logs(
                        fromBlock=current_block,
                        toBlock=latest_block
                    )
                    for event in failsafe_events:
                        process_event(event, 'FailSafeTriggered')
                        
                except Exception as e:
                    logger.error(f"❌ Erro ao processar eventos FailSafe: {str(e)}")
                
                current_block = latest_block + 1
                logger.info(f"✅ Blocos processados. Próximo: {current_block}")
                
                # Heartbeat para monitoramento
                try:
                    from monitor.db import save_metric
                    save_metric("listener.tick", True, 0, {
                        "note": "heartbeat",
                        "block_number": str(current_block)
                    })
                except Exception as e:
                    logger.debug(f"Erro ao salvar heartbeat: {str(e)}")
            
            else:
                logger.debug(f"⏳ Aguardando novos blocos... (atual: {current_block})")
            
            time.sleep(POLL_INTERVAL)
            
        except KeyboardInterrupt:
            logger.info("\n🛑 Listener interrompido pelo usuário")
            break
            
        except Exception as e:
            logger.error(f"❌ Erro no listener: {str(e)}")
            time.sleep(POLL_INTERVAL)

if __name__ == '__main__':
    logger.info("=" * 60)
    logger.info("🎧 BLOCKTRUST BLOCKCHAIN EVENT LISTENER v1.2")
    logger.info("=" * 60)
    listen_events()

