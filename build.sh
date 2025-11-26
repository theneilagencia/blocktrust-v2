#!/bin/bash
set -e

echo "🚀 Building BTS Blocktrust..."
echo "📍 Current directory: $(pwd)"

# Frontend is pre-built and committed to backend/static/
# Skipping frontend build to use committed files
echo "⏭️  Skipping frontend build (using pre-built files from backend/static/)"

# Install backend dependencies
echo "🐍 Installing backend dependencies..."
cd backend
pip install -r requirements.txt

echo "✅ Build completed successfully!"

