const router    = require('express').Router();
const auth      = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const ctrl      = require('../controllers/accessControlController');

router.use(auth, roleGuard('ADMIN'));

router.get('/users',                    ctrl.getAllUsers);
router.get('/:userId',                  ctrl.getUserAccess);
router.post('/:userId/types',           ctrl.addAccessType);
router.delete('/:userId/types/:type',   ctrl.deleteAccessType);
router.post('/:userId/values',          ctrl.addAccessValue);
router.delete('/:userId/values',        ctrl.deleteAccessValue);

module.exports = router;
