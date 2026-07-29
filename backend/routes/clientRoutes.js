// backend/routes/clientRoutes.js
const router    = require('express').Router();
const auth      = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const validate  = require('../middleware/validate');
const schemas   = require('../validation/clientSchemas');
const ctrl      = require('../controllers/clientController');

module.exports = (limiters = {}) => {
  router.use(auth, roleGuard('CLIENT'));

  router.get('/profile',             ctrl.getProfile);
  router.get('/modules',             ctrl.getModules);
  router.get('/modules/reports',     validate(schemas.getReports),        ctrl.getReports);
  router.get('/reports/parameters',  validate(schemas.getParameters),     ctrl.getParameters);
  router.post('/reports/parameters', validate(schemas.refreshParameters), ctrl.refreshParameters);
  // Report generation and file download happen in this single call —
  // apply the (tighter) report limiter here rather than a separate download route.
  router.post('/reports/run', ...[limiters.report].filter(Boolean), validate(schemas.runReport), ctrl.runReport);
  router.get('/history',             ctrl.getHistory);

  return router;
};
