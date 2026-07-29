// backend/routes/authRoutes.js
const router   = require('express').Router();
const auth     = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas  = require('../validation/authSchemas');
const ctrl     = require('../controllers/authController');

module.exports = (limiters = {}) => {
  router.post('/login', ...[limiters.login].filter(Boolean), validate(schemas.login), ctrl.login);
  router.put('/change-password', auth, validate(schemas.changePassword), ctrl.changePassword);
  return router;
};
