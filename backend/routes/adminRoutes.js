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

// Branch access
router.get('/access/branches',                     ctrl.getBranches);
router.post('/access/branches',                    ctrl.addBranch);
router.delete('/access/branches/:userId/:code',    ctrl.deleteBranch);

// Product access
router.get('/access/products',                     ctrl.getProducts);
router.post('/access/products',                    ctrl.addProduct);
router.delete('/access/products/:userId/:code',    ctrl.deleteProduct);

module.exports = router;
