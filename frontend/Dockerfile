# frontend/Dockerfile
# Multi-stage build: compile the React/Vite SPA, then serve the static
# output from a minimal, non-root nginx image.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .

# Vite inlines VITE_* vars at BUILD time, not runtime — so the API base URL
# must be supplied as a build arg. Defaults to a relative path, which is
# correct when nginx/ (the reverse proxy) serves the frontend and proxies
# /api on the same origin — no CORS, no hardcoded host.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1