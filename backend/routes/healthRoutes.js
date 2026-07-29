// backend/routes/healthRoutes.js
const router = require('express').Router();
const ctrl = require('../controllers/healthController');

router.get('/live', ctrl.liveness);
router.get('/ready', ctrl.readiness);

module.exports = router;
