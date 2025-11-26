# Força Python 3.11, compatível com Pillow e todas as libs
FROM python:3.11-slim

# Instala dependências do sistema necessárias para Pillow, psycopg2, web3 etc.
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Define diretório de trabalho
WORKDIR /app

# Copia backend
COPY backend/ /app/

# Instala dependências Python
RUN pip install --upgrade pip setuptools wheel
RUN pip install -r requirements.txt

# Expõe porta
EXPOSE 8000

# Comando para iniciar o servidor
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8000"]
