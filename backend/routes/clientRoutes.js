// backend/routes/clientRoutes.js
const router    = require('express').Router();
const auth      = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const ctrl      = require('../controllers/clientController');

router.use(auth, roleGuard('CLIENT'));

router.get('/profile',            ctrl.getProfile);
router.get('/modules',            ctrl.getModules);
router.get('/modules/reports',    ctrl.getReports);
router.get('/reports/parameters',  ctrl.getParameters);
router.post('/reports/parameters', ctrl.refreshParameters);
router.post('/reports/run',        ctrl.runReport);

module.exports = router;
