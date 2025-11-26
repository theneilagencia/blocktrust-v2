import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Criar engine com pool_pre_ping e pool_recycle conforme recomendação do Render
engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True,  # Testa conexão antes de usar (evita conexões mortas)
    pool_recycle=3600    # Recicla conexões a cada 1 hora (evita timeout do Render)
)

# Criar SessionLocal para uso com SQLAlchemy ORM
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test_connection():
    """
    Testa a conexão com o banco de dados.
    Retorna True se a conexão for bem-sucedida, False caso contrário.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Conexão PostgreSQL OK")
        return True
    except Exception as e:
        print(f"❌ Erro ao conectar: {e}")
        return False

def get_session():
    """
    Retorna uma nova sessão do SQLAlchemy.
    """
    return SessionLocal()

