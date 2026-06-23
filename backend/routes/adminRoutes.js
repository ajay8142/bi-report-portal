// backend/routes/adminRoutes.js
const router    = require('express').Router();
const auth      = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const ctrl      = require('../controllers/adminController');

router.use(auth, roleGuard('ADMIN'));

router.get('/dashboard',                         ctrl.getDashboard);
router.get('/modules',                           ctrl.getModules);
router.get('/modules/reports',                   ctrl.getReports);
router.get('/clients',                           ctrl.getClients);
router.post('/clients',                          ctrl.createClient);
router.put('/clients/:id',                       ctrl.updateClient);
router.delete('/clients/:id',                    ctrl.deleteClient);
router.get('/assignments/:clientId',             ctrl.getAssignments);
router.post('/assignments',                      ctrl.toggleAssignment);
router.put('/assignments/:clientId/disable-all', ctrl.disableAllAssignments);

module.exports = router;
