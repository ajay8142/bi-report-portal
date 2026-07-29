// backend/ecosystem.config.js
// PM2 config used by `pm2-runtime` inside the backend container.
// Fork mode, single instance per container: horizontal scale-out is handled
// at the Docker/nginx layer (backend1 + backend2), so PM2's job here is just
// process supervision — auto-restart on crash, graceful SIGTERM handling, and
// stdout/stderr log management — not clustering.
module.exports = {
  apps: [
    {
      name: 'bi-report-backend',
      script: 'server.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '512M',
      kill_timeout: 20_000, // > server.js's own 15s graceful-shutdown timeout
      listen_timeout: 10_000,
      wait_ready: false,
      // PM2 log files aren't used — pm2-runtime already forwards app
      // stdout/stderr to the container's stdout/stderr for `docker logs`.
      out_file: '/dev/stdout',
      error_file: '/dev/stderr',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
