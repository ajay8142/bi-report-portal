// backend/middleware/rateLimiter.js
//
// Per-route-class rate limiting, in-memory (per Node process).
//
// Caveat: when running the two-container backend1/backend2 setup in
// docker-compose.yml, each container keeps its own counter — a client
// hitting both containers behind the nginx LB effectively gets up to 2x the
// limit below before either instance blocks it. The nginx-level limits in
// nginx/conf.d/ratelimit.conf apply across both containers and are the real
// backstop for that case; treat these as a secondary, per-instance layer.
// If that gap matters for your deployment, share the counters through a
// central store (Redis, etc.) instead of in-memory.

const rateLimit = require('express-rate-limit');

function makeLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: message || 'Too many requests, please try again later.' },
    keyGenerator: (req) => req.ip,
  });
}

module.exports = function createRateLimiters() {
  return {
    // Brute-force protection on credential checking.
    login: makeLimiter({
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: 'Too many login attempts. Please try again in 15 minutes.',
    }),

    // Report generation hits Oracle + BI Publisher/ReportingTool — expensive,
    // needs a tighter ceiling than general API traffic.
    report: makeLimiter({
      windowMs: 5 * 60 * 1000,
      max: 20,
      message: 'Too many report requests. Please slow down and try again shortly.',
    }),

    // File download/streaming — moderate limit, mainly to stop scripted scraping.
    download: makeLimiter({
      windowMs: 5 * 60 * 1000,
      max: 30,
      message: 'Too many download requests. Please try again shortly.',
    }),

    // Baseline ceiling for every other /api call.
    general: makeLimiter({
      windowMs: 60 * 1000,
      max: 120,
      message: 'Too many requests. Please slow down.',
    }),
  };
};
