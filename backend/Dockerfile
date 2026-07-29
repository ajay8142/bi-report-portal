# backend/Dockerfile
# Multi-stage build: install deps in a throwaway stage, copy only the
# production node_modules + app source into the final image.
#
# Assumes node-oracledb runs in THIN mode (no oracledb.initOracleClient call
# in config/db.js, which is the current default). Thin mode is pure JS and
# needs no Oracle Instant Client in the image. If you switch to thick mode,
# you'll need to install the Instant Client libs in the runtime stage.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Used only by docker-compose.dev.yml (`target: dev-deps`) for hot-reload
# local dev — includes devDependencies (nodemon) that the production `deps`
# stage above deliberately omits.
FROM node:20-alpine AS dev-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS runtime
# tini is a tiny init process: reaps zombie processes and correctly forwards
# SIGTERM/SIGINT to pm2-runtime (PID 1 problem when running Node directly in Docker).
RUN apk add --no-cache tini curl

WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY . .
RUN rm -f ajay.js .env

# Install pm2 globally for process supervision (auto-restart, graceful shutdown, log management).
RUN npm install -g pm2 --no-audit --no-fund

# node:alpine images ship a non-root "node" user (uid 1000) — use it instead of root.
RUN chown -R node:node /app
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT:-5000}/health/live || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["pm2-runtime", "ecosystem.config.js"]
