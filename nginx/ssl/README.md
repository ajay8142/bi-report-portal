# TLS certificates

`docker-compose.yml` bind-mounts this directory read-only into the reverse
proxy at `/etc/nginx/ssl`. nginx expects exactly these two files here:

- `fullchain.pem`
- `privkey.pem`

## Local / dev

```bash
./generate-self-signed.sh yourhost.local
```

Browsers will show a trust warning for self-signed certs — that's expected.

## Production

Drop your real certificate chain and private key in as `fullchain.pem` /
`privkey.pem` (e.g. from Let's Encrypt, or your org's CA), matching your real
`server_name` in `nginx/conf.d/default.conf`. Then either:

- Restart the `reverse-proxy` container to pick up the new files, or
- `docker compose exec reverse-proxy nginx -s reload` for a zero-downtime reload.

For automated renewal, the HTTP server block already carves out
`/.well-known/acme-challenge/` for certbot's http-01 challenge — wire a
certbot container or cron job to write into that path and re-run this
directory's cert files, then reload.

Never commit real private keys to git — this directory's `*.pem` files are
already covered by `.gitignore`.
