#!/usr/bin/env bash
# install.sh — first-time setup for the Docker stack (docker-compose.yml).
#
# Idempotent: safe to re-run, it only fills in what's missing and never
# overwrites an existing backend/.env or existing TLS certs.
#
# What it does:
#   1. Checks Docker + Docker Compose v2 are installed.
#   2. Creates backend/.env from backend/.env.example if it doesn't exist yet
#      (you still need to edit it with real DB/BIP/JWT credentials).
#   3. Generates a self-signed dev TLS cert in nginx/ssl/ if none is present.
#   4. Builds and starts the full stack.
#
# See DEPLOYMENT.md for what this doesn't cover (scaling, cert renewal,
# monitoring add-on, CI/CD).

set -euo pipefail
cd "$(dirname "$0")"

echo "==> Checking prerequisites"
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required: https://docs.docker.com/get-docker/" >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required (the 'docker compose' subcommand)." >&2
  exit 1
fi

echo "==> Checking backend/.env"
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "  created backend/.env from backend/.env.example"
  echo "  *** edit backend/.env with real DB_*/BIP_*/JWT_SECRET/FRONTEND_URL values before going further ***"
else
  echo "  backend/.env already exists — leaving it alone"
fi

echo "==> Checking TLS cert (nginx/ssl/)"
if [ ! -f nginx/ssl/fullchain.pem ] || [ ! -f nginx/ssl/privkey.pem ]; then
  ./nginx/ssl/generate-self-signed.sh localhost
  echo "  generated a self-signed dev cert — replace with a real one before going to production (see nginx/ssl/README.md)"
else
  echo "  nginx/ssl/fullchain.pem + privkey.pem already present — leaving them alone"
fi

echo "==> Building and starting the stack"
docker compose up -d --build

echo
echo "==> Done. Useful next steps:"
echo "    docker compose ps                  # all services should report 'healthy'"
echo "    docker compose logs -f backend1    # tail a container's logs"
echo "    curl -k https://localhost/healthz  # reverse proxy health check"
