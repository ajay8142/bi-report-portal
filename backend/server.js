// backend/server.js
require('dotenv').config();
require('express-async-errors');
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const db       = require('./config/db');
const createRateLimiters = require('./middleware/rateLimiter');

const healthRoutes        = require('./routes/healthRoutes');
const authRoutesFactory   = require('./routes/authRoutes');
const adminRoutes         = require('./routes/adminRoutes');
const clientRoutesFactory = require('./routes/clientRoutes');

const app = express();

// Sitting behind the nginx reverse proxy — trust its X-Forwarded-* headers
// so req.ip (used as the rate-limit key) reflects the real client, not the proxy.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

const limiters = createRateLimiters();

// Unauthenticated, unrate-limited — polled frequently by Docker/nginx healthchecks.
app.use('/health', healthRoutes);

app.use('/api', limiters.general);
app.use('/api/auth',   authRoutesFactory(limiters));
app.use('/api/admin',  adminRoutes);
app.use('/api/client', clientRoutesFactory(limiters));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;

let server;
db.initialize().then(() => {
  server = app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}).catch(err => { console.error('❌ DB init failed:', err); process.exit(1); });

// Graceful shutdown: stop accepting new connections, let in-flight requests
// finish, then close the Oracle pool before exiting. PM2/Docker send SIGTERM
// on stop/restart — without this, in-flight report generations get dropped
// and the Oracle pool is left dangling.
async function shutdown(signal) {
  console.log(`${signal} received — shutting down gracefully`);
  const forceExit = setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 15_000);

  try {
    if (server) await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await db.close();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
