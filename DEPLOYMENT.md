# Deployment

Production topology:

```
                 reverse-proxy (nginx, :80 -> :443 redirect, TLS termination)
                        │
            ┌───────────┴───────────┐
            │                       │
        frontend                backend_api (round robin)
      (nginx, static SPA)         ├── backend1
                                   └── backend2

Oracle DB — external, not containerized (DB_CONNECT_STRING in backend/.env)
Oracle BI Publisher / ReportingTool — external (BIP_BASE_URL / REPORTING_TOOL_BASE_URL)
```

No Redis/shared cache in this stack — see the "Rate limiting" caveat below for
the one place that actually matters.

## Fast path

```bash
./install.sh
```

Checks Docker is installed, then walks you through `backend/.env` interactively
(Oracle DB connection, BI Publisher/ReportingTool, JWT, public origin) —
auto-generating `JWT_SECRET` on first run. Generates a self-signed dev TLS
cert if `nginx/ssl/` is empty, then runs `docker compose up -d --build`.

**Re-run it any time to change config** (rotate `JWT_SECRET`, update the Oracle
connect string, switch the default report engine, etc.) — it's idempotent:
existing `backend/.env` values are offered as the default at each prompt
instead of starting blank, and pressing Enter keeps them. Changes take effect
on the next `docker compose up -d --build`, which this script runs for you.

`backend/.env.example` documents the same fields for reference (e.g. if you'd
rather hand-edit the file instead of running the prompts).

## First-time setup (manual, if you'd rather not use the prompts)

1. **Backend env**: copy `backend/.env.example` to `backend/.env` and fill in
   real `DB_*`/`BIP_*`/`JWT_SECRET` values. Confirm `FRONTEND_URL` is set to
   your public origin (e.g. `https://yourhost`).
2. **TLS cert**: for local/dev,
   ```bash
   ./nginx/ssl/generate-self-signed.sh yourhost.local
   ```
   For real deployments, drop your CA-issued `fullchain.pem` / `privkey.pem`
   into `nginx/ssl/` instead — see `nginx/ssl/README.md`.
3. **Build and start everything**:
   ```bash
   docker compose up -d --build
   ```
4. **Check health**:
   ```bash
   docker compose ps                       # all should report "healthy"
   curl -k https://localhost/healthz       # reverse proxy
   curl -k https://localhost/api/          # 404 from Express = backend reachable
   ```

## Local backend development (hot reload)

Containerizes just `backend1` with nodemon and a source volume mount; keep
running the frontend with `npm run dev` as before.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build backend1
```

## Scaling

The backend tier is a fixed two-node cluster (`backend1`/`backend2`), not
`--scale`-based — `nginx/conf.d/upstream.conf` lists both by name so nginx's
round-robin + passive health check (`max_fails`/`fail_timeout`) can do
automatic failover between them. To add a third node, add a `backend3`
service block to `docker-compose.yml` (copy `backend2`) and a matching
`server backend3:5000 ...;` line in `upstream.conf`, then
`docker compose up -d --build`.

## Rate limiting

Two layers, same route grouping (login / report+download / general):

- **Edge** (`nginx/conf.d/ratelimit.conf`) — drops floods before they reach
  Node, and applies correctly across both `backend1`/`backend2` since nginx is
  the single point both go through. This is the real backstop.
- **Application** (`backend/middleware/rateLimiter.js`) — in-memory, per Node
  process. With both backend containers live, a client can get up to ~2x the
  stated limit before either instance individually blocks it (each container
  counts its own requests only). If that gap matters for your deployment,
  point both limiters at a shared store (Redis or similar) instead — this
  stack intentionally doesn't run one.

`nginx/conf.d/blocklist.conf` is the manual IP-block hook point (`deny <ip>;`)
for ad-hoc bans — there's no automated fail2ban-style engine wired up here.

## TLS renewal

`nginx/conf.d/default.conf` already carves out `/.well-known/acme-challenge/`
for certbot's http-01 challenge. Wire a certbot container/cron job to write
into the `acme-webroot` volume and refresh `nginx/ssl/*.pem`, then either
restart `reverse-proxy` or `docker compose exec reverse-proxy nginx -s reload`
for a zero-downtime pickup.

## Monitoring (optional)

Container-level CPU/memory/disk/network via cAdvisor + Prometheus + Grafana:

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d --build
```

Grafana: `http://<host>:3001` (default `admin`/`admin` — change immediately).
Add the app-level equivalent (structured logs, error tracking, APM) separately
when you're ready — this add-on only covers infrastructure metrics, not
application traces/errors.

## CI/CD

`.github/workflows/docker-build.yml` lints both apps and builds both Docker
images on every push/PR; on `main` and version tags it also pushes to
`ghcr.io/<org>/<repo>/{backend,frontend}` tagged by git SHA, branch, semver,
and `latest`. Deploying a specific version is then a `docker pull` of a known
tag rather than a rebuild from source. Zero-downtime rolling updates aren't
wired up yet (noted as future work in the original checklist) — today,
`docker compose up -d --build` recreates containers with a brief gap; adding
that later means either Docker Swarm/Kubernetes rolling updates or a
blue/green pair of `backend1`/`backend2` deploys behind the existing nginx
upstream.

## What's intentionally out of scope here

- **Oracle DB** — external by design (per the original requirements); this
  compose stack doesn't manage it.
- **Secrets management** — `backend/.env` is a file today. For real
  production, move `JWT_SECRET`/`DB_PASSWORD`/`BIP_PASSWORD`/etc. into Docker
  secrets, Vault, or your cloud provider's secrets manager, and have
  `docker-compose.yml` reference those instead of a plain env file.
- **Automated IP banning** (fail2ban/CrowdSec) — the hook point exists
  (`nginx/conf.d/blocklist.conf`) but isn't automated.
