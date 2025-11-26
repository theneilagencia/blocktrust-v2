#!/bin/bash
cd /home/ubuntu/blocktrust/backend
export $(cat .env | grep -v '^#' | xargs)
exec python3 app.py
