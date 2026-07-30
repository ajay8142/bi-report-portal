#!/usr/bin/env bash
# nginx/ssl/generate-self-signed.sh
#
# Generates a throwaway self-signed cert for local/dev use so the reverse
# proxy can terminate TLS out of the box. Browsers will show a trust warning
# (expected for self-signed) — for a real deployment, replace fullchain.pem
# and privkey.pem in this directory with certs from your CA / Let's Encrypt
# and skip this script. See nginx/ssl/README.md.

set -euo pipefail
cd "$(dirname "$0")"

DOMAIN="${1:-localhost}"
DAYS="${2:-365}"

openssl req -x509 -nodes -days "$DAYS" -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/C=IN/ST=NA/L=NA/O=BI Report Portal/CN=${DOMAIN}" \
  -addext "subjectAltName=DNS:${DOMAIN},DNS:localhost,IP:127.0.0.1"

chmod 644 fullchain.pem
chmod 600 privkey.pem

echo "Generated self-signed cert for '${DOMAIN}' (valid ${DAYS} days):"
echo "  $(pwd)/fullchain.pem"
echo "  $(pwd)/privkey.pem"
