// backend/controllers/healthController.js
const db = require('../config/db');
const reportEngine = require('../config/reportEngine');

// Liveness: process is up and can handle requests. No dependency checks —
// Docker/orchestrator should restart the container only when the process
// itself is wedged, not when a downstream dependency is flaky.
exports.liveness = (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
};

// Readiness: safe to receive traffic. Checked by the LB/compose healthcheck
// before routing requests to this instance.
exports.readiness = async (req, res) => {
  const checks = { db: false, reportEngine: false };
  let dbError;

  try {
    await db.execute('SELECT 1 FROM DUAL');
    checks.db = true;
  } catch (err) {
    dbError = err.message;
  }

  try {
    reportEngine.getService();
    checks.reportEngine = true;
  } catch {
    checks.reportEngine = false;
  }

  // DB is the only hard dependency — BIP/ReportingTool being down is
  // degraded service, not "take this instance out of the LB rotation".
  const ready = checks.db;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks,
    ...(dbError && { dbError }),
  });
};
