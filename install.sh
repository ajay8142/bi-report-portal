#!/usr/bin/env bash
# install.sh — guided setup for a fresh install, or to change config later.
#
# Idempotent: if backend/.env already exists, its current values are offered
# as defaults instead of starting blank, so re-running this script is also
# how you edit config afterward (Oracle connection string changed, rotating
# JWT_SECRET, switching the default report engine, etc.) without hand-editing
# a dozen-field .env. Changes take effect on the next
# `docker compose up -d --build` — the named volumes (acme-webroot, monitoring
# data) are untouched either way.
#
# What it does:
#   1. Checks Docker + Docker Compose v2 are installed.
#   2. Walks you through backend/.env (Oracle DB, BI Publisher/ReportingTool,
#      JWT, CORS origin), writing it with permissions restricted to your user.
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

ENV_FILE="backend/.env"
[ -f "$ENV_FILE" ] && set -a && source "$ENV_FILE" && set +a

# ask VAR_NAME "prompt text" ["default if nothing typed and no current value"]
ask() {
    local var_name="$1" prompt="$2" fallback="${3:-}"
    local current="${!var_name:-$fallback}"
    local input
    if [ -n "$current" ]; then
        read -r -p "$prompt [$current]: " input
        printf -v "$var_name" '%s' "${input:-$current}"
    else
        read -r -p "$prompt: " input
        printf -v "$var_name" '%s' "$input"
    fi
}

# Same as ask(), but for secrets: input isn't echoed, and an existing value is
# never printed back to the terminal — just "[unchanged]" if one is set.
ask_secret() {
    local var_name="$1" prompt="$2"
    local current="${!var_name:-}"
    local input
    if [ -n "$current" ]; then
        read -r -s -p "$prompt [unchanged]: " input
        echo
        printf -v "$var_name" '%s' "${input:-$current}"
    else
        read -r -s -p "$prompt: " input
        echo
        printf -v "$var_name" '%s' "$input"
    fi
}

echo
echo "=== backend/.env setup ==="
echo "(Press Enter to keep the current/default value shown in brackets.)"
echo

# --- CORS: the single public origin the frontend will be reached at ---
# (the nginx reverse proxy serves frontend + /api on this same origin — see
# DEPLOYMENT.md's topology diagram — so this is one URL, not a list.)
ask FRONTEND_URL "Public origin the app will be reached at" "https://localhost"

# --- JWT ---
echo
if [ -z "${JWT_SECRET:-}" ]; then
    if command -v openssl >/dev/null 2>&1; then
        JWT_SECRET="$(openssl rand -hex 32)"
    elif command -v python3 >/dev/null 2>&1; then
        JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
    else
        echo "Neither openssl nor python3 found to generate a secret — please enter one manually."
        ask_secret JWT_SECRET "JWT signing secret"
    fi
    echo "Generated a new JWT_SECRET."
else
    read -r -p "Keep existing JWT_SECRET? [Y/n] (rotating it signs everyone out): " keep
    if [[ "$keep" =~ ^[Nn] ]]; then
        JWT_SECRET="$(openssl rand -hex 32 2>/dev/null || python3 -c 'import secrets; print(secrets.token_hex(32))')"
        echo "Generated a new JWT_SECRET — every current login session is now invalid."
    fi
fi
ask JWT_EXPIRES_IN "Token lifetime (e.g. 8h, 30m)" "8h"

# --- Oracle DB (external — this stack doesn't containerize it) ---
echo
echo "Oracle DB connection (existing instance — not managed by this stack):"
ask DB_USER "  DB_USER"
ask_secret DB_PASSWORD "  DB_PASSWORD"
ask DB_CONNECT_STRING "  DB_CONNECT_STRING (host:port/service_name, or a full connect descriptor)"

# --- Oracle BI Publisher (the default report engine) ---
echo
echo "Oracle BI Publisher SOAP connection:"
ask BIP_BASE_URL "  BIP_BASE_URL (e.g. https://bip.yourcompany.com:9704)"
ask BIP_USERNAME "  BIP_USERNAME"
ask_secret BIP_PASSWORD "  BIP_PASSWORD"

# --- Report engine default (switchable live later from the admin top-bar) ---
echo
echo "Which report engine should this deployment default to at startup?"
echo "  1) bip           - real Oracle BI Publisher SOAP service (default)"
echo "  2) reportingtool - ReportingTool's REST shim (BIP Free)"
echo "(Admins can flip this live later from the admin top-bar dropdown without restarting.)"
current_choice=1
[ "${REPORT_ENGINE:-bip}" = "reportingtool" ] && current_choice=2
read -r -p "Choice [${current_choice}]: " engine_choice
engine_choice="${engine_choice:-$current_choice}"

case "$engine_choice" in
    2)
        REPORT_ENGINE="reportingtool"
        ask REPORTING_TOOL_BASE_URL "  REPORTING_TOOL_BASE_URL"
        ask REPORTING_TOOL_USERNAME "  REPORTING_TOOL_USERNAME"
        ask_secret REPORTING_TOOL_PASSWORD "  REPORTING_TOOL_PASSWORD"
        ;;
    *)
        REPORT_ENGINE="bip"
        ;;
esac

# --- Write backend/.env ---
# PORT isn't asked: docker-compose.yml pins the in-container port to 5000
# explicitly for both backend containers, so a different value here would be
# silently overridden anyway.
cat > "$ENV_FILE" <<EOF
# Server
PORT=5000
NODE_ENV=production

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=${JWT_EXPIRES_IN}

# Oracle DB (external — not containerized)
DB_USER=${DB_USER:-}
DB_PASSWORD=${DB_PASSWORD:-}
DB_CONNECT_STRING=${DB_CONNECT_STRING:-}

# Oracle BI Publisher
BIP_BASE_URL=${BIP_BASE_URL:-}
BIP_USERNAME=${BIP_USERNAME:-}
BIP_PASSWORD=${BIP_PASSWORD:-}

# Report engine: "bip" (real BI Publisher SOAP) or "reportingtool" (REST shim)
REPORT_ENGINE=${REPORT_ENGINE}
REPORTING_TOOL_BASE_URL=${REPORTING_TOOL_BASE_URL:-}
REPORTING_TOOL_USERNAME=${REPORTING_TOOL_USERNAME:-}
REPORTING_TOOL_PASSWORD=${REPORTING_TOOL_PASSWORD:-}

# CORS — the reverse proxy's public origin
FRONTEND_URL=${FRONTEND_URL}
EOF

# Restrict who can read this file — it holds JWT_SECRET and Oracle/BIP
# credentials — before anything else touches it.
chmod 600 "$ENV_FILE"

echo
echo "Wrote $ENV_FILE (permissions restricted to your user)."

echo
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
echo
echo "Admin/client accounts live in the existing Oracle USERS table (this stack"
echo "doesn't create or seed one) — sign in with an account that already exists there."
