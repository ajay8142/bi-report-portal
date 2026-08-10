// backend/middleware/rateLimiter.js
//
// Per-route-class rate limiting, in-memory (per Node process). Since
// docker-compose.yml runs a single backend container, this counter is
// authoritative — no cross-container double-counting to worry about. The
// nginx-level limits in nginx/conf.d/ratelimit.conf still apply ahead of
// this as defense in depth.

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
