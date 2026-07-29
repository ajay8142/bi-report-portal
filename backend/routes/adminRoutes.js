// backend/routes/adminRoutes.js
const router    = require('express').Router();
const auth      = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const validate  = require('../middleware/validate');
const schemas   = require('../validation/adminSchemas');
const ctrl      = require('../controllers/adminController');

router.use(auth, roleGuard('ADMIN'));

router.get('/report-engine',                     ctrl.getReportEngine);
router.put('/report-engine',                     validate(schemas.setReportEngine),      ctrl.setReportEngine);

router.get('/dashboard',                         ctrl.getDashboard);
router.get('/modules',                           validate(schemas.getModules),           ctrl.getModules);
router.get('/modules/reports',                   validate(schemas.getReports),           ctrl.getReports);
router.get('/clients',                           ctrl.getClients);
router.post('/clients',                          validate(schemas.createClient),         ctrl.createClient);
router.put('/clients/:id',                       validate(schemas.updateClient),         ctrl.updateClient);
router.delete('/clients/:id',                    validate(schemas.idParams),             ctrl.deleteClient);
router.get('/assignments/:clientId',             validate(schemas.clientIdParams),       ctrl.getAssignments);
router.get('/history/:clientId',                 validate(schemas.clientIdParams),       ctrl.getClientHistory);
router.get('/roles/:clientId',                   validate(schemas.clientIdParams),       ctrl.getUserRoles);
router.post('/assignments',                      validate(schemas.toggleAssignment),     ctrl.toggleAssignment);
router.put('/assignments/flag',                  validate(schemas.setAssignmentFlag),    ctrl.setAssignmentFlag);
router.put('/assignments/:clientId/disable-all', validate(schemas.clientIdParams),       ctrl.disableAllAssignments);

// Branch access
router.get('/access/branches',                     ctrl.getBranches);
router.post('/access/branches',                    validate(schemas.accessMutation),      ctrl.addBranch);
router.delete('/access/branches/:userId/:code',    validate(schemas.accessDeletion),      ctrl.deleteBranch);

// Product access
router.get('/access/products',                     ctrl.getProducts);
router.post('/access/products',                    validate(schemas.accessMutation),      ctrl.addProduct);
router.delete('/access/products/:userId/:code',    validate(schemas.accessDeletion),      ctrl.deleteProduct);

module.exports = router;
