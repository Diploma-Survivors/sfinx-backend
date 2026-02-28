#!/usr/bin/env bash
# Run sfinx-backend locally for development
# Backend runs on http://localhost:3000

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check .env exists
if [[ ! -f .env ]]; then
  echo "Error: .env not found. Copy from .env.example and configure:"
  echo "  cp .env.example .env"
  exit 1
fi

# Install dependencies if needed
if [[ ! -d node_modules ]]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting sfinx-backend on http://localhost:3000"
echo "Swagger docs: http://localhost:3000/api/docs"
npm run start:dev
