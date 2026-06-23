// ============================================================
// backend/controllers/adminController.js
// ============================================================
const bcrypt   = require('bcryptjs');
const oracledb = require('oracledb');
const db       = require('../config/db');
const bip      = require('../services/bipSoapService');

exports.getDashboard = async (req, res) => {
  const clientResult = await db.execute(
    `SELECT COUNT(*) AS TOTAL_CLIENTS FROM USERS WHERE ROLE='CLIENT' AND IS_ACTIVE=1`
  );
  const modules = await bip.getModules('/Generic Reports');
  let totalReports = 0;
  for (const mod of modules) {
    const reps = await bip.getReportsByModule(mod.absolutePath);
    totalReports += reps.length;
  }
  res.json({
    success: true,
    data: {
      totalClients: clientResult.rows[0].TOTAL_CLIENTS,
      totalModules: modules.length,
      totalReports,
    },
  });
};

exports.getModules = async (req, res) => {
  const modules = await bip.getModules(req.query.path || '/Generic Reports');
  res.json({ success: true, data: modules });
};

exports.getReports = async (req, res) => {
  const { path } = req.query; 
  
  if (!path || path === 'undefined') {
    return res.status(400).json({ success: false, message: 'Module path required' });
  }
  
  try {
    // Fetch mapped data directly from the service
    const reports = await bip.getReportsByModule(path);
    
    res.json({ success: true, data: reports });
  } catch (err) {
    console.error("🚨 Error fetching reports:", err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch reports' });
  }
};

exports.getClients = async (req, res) => {
  const result = await db.execute(
    `SELECT USER_ID, NAME, EMAIL, IS_ACTIVE, CREATED_AT
     FROM USERS WHERE ROLE='CLIENT' ORDER BY CREATED_AT DESC`
  );
  res.json({ success: true, data: result.rows });
};

exports.createClient = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ success: false, message: 'name, email and password are required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ success: false, message: 'Invalid email format' });
  if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/.test(password))
    return res.status(400).json({ success: false, message: 'Password: min 8 chars, 1 uppercase, 1 number, 1 special char' });

  const dup = await db.execute(`SELECT USER_ID FROM USERS WHERE EMAIL=:email`, { email: email.toLowerCase().trim() });
  if (dup.rows.length) return res.status(409).json({ success: false, message: 'Email already exists' });

  const hash   = await bcrypt.hash(password, 12);
  const result = await db.execute(
    `INSERT INTO USERS (NAME,EMAIL,PASSWORD_HASH,ROLE)
     VALUES (:name,:email,:hash,'CLIENT') RETURNING USER_ID INTO :userId`,
    { name: name.trim(), email: email.toLowerCase().trim(), hash, userId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
  );
  res.status(201).json({ success: true, message: 'Client created', data: { userId: result.outBinds.userId[0] } });
};

exports.updateClient = async (req, res) => {
  const { id } = req.params;
  const { name, is_active } = req.body;
  await db.execute(
    `UPDATE USERS SET NAME=NVL(:name,NAME), IS_ACTIVE=NVL(:isActive,IS_ACTIVE), UPDATED_AT=SYSTIMESTAMP
     WHERE USER_ID=:id AND ROLE='CLIENT'`,
    { name: name || null, isActive: is_active ?? null, id: Number(id) }
  );
  res.json({ success: true, message: 'Client updated' });
};

exports.deleteClient = async (req, res) => {
  await db.execute(`DELETE FROM USERS WHERE USER_ID=:id AND ROLE='CLIENT'`, { id: Number(req.params.id) });
  res.json({ success: true, message: 'Client deleted' });
};

exports.getAssignments = async (req, res) => {
  const result = await db.execute(
    `SELECT ASSIGNMENT_ID, MODULE_NAME, MODULE_PATH, REPORT_NAME, REPORT_PATH, IS_ENABLED
     FROM REPORT_ASSIGNMENTS WHERE USER_ID=:clientId ORDER BY MODULE_NAME, REPORT_NAME`,
    { clientId: Number(req.params.clientId) }
  );
  res.json({ success: true, data: result.rows });
};

exports.toggleAssignment = async (req, res) => {
  const { clientId, moduleName, modulePath, reportName, reportPath, isEnabled } = req.body;
  if (!clientId || !reportPath)
    return res.status(400).json({ success: false, message: 'clientId and reportPath required' });

  const existing = await db.execute(
    `SELECT ASSIGNMENT_ID FROM REPORT_ASSIGNMENTS WHERE USER_ID=:clientId AND REPORT_PATH=:reportPath`,
    { clientId: Number(clientId), reportPath }
  );
  if (existing.rows.length) {
    await db.execute(
      `UPDATE REPORT_ASSIGNMENTS SET IS_ENABLED=:isEnabled, ASSIGNED_AT=SYSTIMESTAMP
       WHERE USER_ID=:clientId AND REPORT_PATH=:reportPath`,
      { isEnabled: isEnabled ? 1 : 0, clientId: Number(clientId), reportPath }
    );
  } else {
    await db.execute(
      `INSERT INTO REPORT_ASSIGNMENTS (USER_ID,MODULE_NAME,MODULE_PATH,REPORT_NAME,REPORT_PATH,IS_ENABLED)
       VALUES(:clientId,:moduleName,:modulePath,:reportName,:reportPath,:isEnabled)`,
      { clientId: Number(clientId), moduleName: moduleName||'', modulePath: modulePath||'',
        reportName: reportName||'', reportPath, isEnabled: isEnabled ? 1 : 0 }
    );
  }
  res.json({ success: true, message: `Report ${isEnabled ? 'enabled' : 'disabled'}` });
};

exports.disableAllAssignments = async (req, res) => {
  await db.execute(
    `UPDATE REPORT_ASSIGNMENTS SET IS_ENABLED=0, ASSIGNED_AT=SYSTIMESTAMP WHERE USER_ID=:clientId`,
    { clientId: Number(req.params.clientId) }
  );
  res.json({ success: true, message: 'All reports disabled' });
};
