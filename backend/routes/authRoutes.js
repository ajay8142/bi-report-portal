// backend/routes/authRoutes.js
const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/authController');

router.post('/login',           ctrl.login);
router.put('/change-password',  auth, ctrl.changePassword);

module.exports = router;
