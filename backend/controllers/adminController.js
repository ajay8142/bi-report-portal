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
    `SELECT USER_ID, NAME, USER_NAME, EMAIL, IS_ACTIVE, CREATED_AT
     FROM USERS WHERE ROLE='CLIENT' ORDER BY CREATED_AT DESC`
  );
  res.json({ success: true, data: result.rows });
};

exports.createClient = async (req, res) => {
  const { name, user_name, email, password } = req.body;
  if (!name || !user_name || !email || !password)
    return res.status(400).json({ success: false, message: 'name, user_name, email and password are required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ success: false, message: 'Invalid email format' });
  if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/.test(password))
    return res.status(400).json({ success: false, message: 'Password: min 8 chars, 1 uppercase, 1 number, 1 special char' });

  const dup = await db.execute(`SELECT USER_ID FROM USERS WHERE EMAIL=:email`, { email: email.toLowerCase().trim() });
  if (dup.rows.length) return res.status(409).json({ success: false, message: 'Email already exists' });

  const dupUserName = await db.execute(`SELECT USER_ID FROM USERS WHERE USER_NAME=:userName`, { userName: user_name.trim() });
  if (dupUserName.rows.length) return res.status(409).json({ success: false, message: 'Username already exists' });

  const hash   = await bcrypt.hash(password, 12);
  const result = await db.execute(
    `INSERT INTO USERS (NAME,USER_NAME,EMAIL,PASSWORD_HASH,ROLE)
     VALUES (:name,:userName,:email,:hash,'CLIENT') RETURNING USER_ID INTO :userId`,
    { name: name.trim(), userName: user_name.trim(), email: email.toLowerCase().trim(), hash, userId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
  );
  res.status(201).json({ success: true, message: 'Client created', data: { userId: result.outBinds.userId[0] } });
};

exports.updateClient = async (req, res) => {
  const { id } = req.params;
  const { name, user_name, is_active } = req.body;
  await db.execute(
    `UPDATE USERS SET NAME=NVL(:name,NAME), USER_NAME=NVL(:userName,USER_NAME), IS_ACTIVE=NVL(:isActive,IS_ACTIVE), UPDATED_AT=SYSTIMESTAMP
     WHERE USER_ID=:id AND ROLE='CLIENT'`,
    { name: name || null, userName: user_name || null, isActive: is_active ?? null, id: Number(id) }
  );
  res.json({ success: true, message: 'Client updated' });
};

exports.deleteClient = async (req, res) => {
  await db.execute(`DELETE FROM USERS WHERE USER_ID=:id AND ROLE='CLIENT'`, { id: Number(req.params.id) });
  res.json({ success: true, message: 'Client deleted' });
};

exports.getAssignments = async (req, res) => {
  const result = await db.execute(
    `SELECT ASSIGNMENT_ID, MODULE_NAME, MODULE_PATH, REPORT_NAME, REPORT_PATH, IS_ENABLED, USER_ROLE, PRINT_FLAG, GENERATE_FLAG
     FROM REPORT_ASSIGNMENTS WHERE USER_ID=:clientId ORDER BY MODULE_NAME, REPORT_NAME`,
    { clientId: Number(req.params.clientId) }
  );
  res.json({ success: true, data: result.rows });
};

// GET /admin/history/:clientId — a client's report generation/print log, newest first.
exports.getClientHistory = async (req, res) => {
  const result = await db.execute(
    `SELECT LOG_ID, REPORT_NAME, ACTION, FORMAT, IP_ADDRESS, CREATED_AT
     FROM AUDIT_LOGS
     WHERE USER_ID = :clientId
     ORDER BY CREATED_AT DESC
     FETCH FIRST 200 ROWS ONLY`,
    { clientId: Number(req.params.clientId) }
  );
  res.json({ success: true, data: result.rows });
};

// GET /admin/roles/:clientId — roles the client's core-banking user is authorized for,
// sourced from SMTB_USER_ROLE, for the admin to pick from when assigning a report.
exports.getUserRoles = async (req, res) => {
  const clientId = Number(req.params.clientId);
  const userResult = await db.execute(`SELECT USER_NAME FROM USERS WHERE USER_ID = :clientId`, { clientId });
  const userName = userResult.rows[0]?.USER_NAME;
  if (!userName) return res.status(404).json({ success: false, message: 'Client not found' });

  const result = await db.execute(
    `SELECT DISTINCT ROLE_ID FROM SMTB_USER_ROLE WHERE USER_ID = :userName ORDER BY ROLE_ID`,
    { userName }
  );
  res.json({ success: true, data: result.rows.map(r => r.ROLE_ID) });
};

exports.toggleAssignment = async (req, res) => {
  const { clientId, moduleName, modulePath, reportName, reportPath, isEnabled, userRole } = req.body;
  if (!clientId || !reportPath)
    return res.status(400).json({ success: false, message: 'clientId and reportPath required' });
  if (isEnabled && !userRole)
    return res.status(400).json({ success: false, message: 'userRole is required to enable a report' });

  const existing = await db.execute(
    `SELECT ASSIGNMENT_ID FROM REPORT_ASSIGNMENTS WHERE USER_ID=:clientId AND REPORT_PATH=:reportPath`,
    { clientId: Number(clientId), reportPath }
  );
  if (existing.rows.length) {
    await db.execute(
      `UPDATE REPORT_ASSIGNMENTS SET IS_ENABLED=:isEnabled, USER_ROLE=NVL(:userRole, USER_ROLE), ASSIGNED_AT=SYSTIMESTAMP
       WHERE USER_ID=:clientId AND REPORT_PATH=:reportPath`,
      { isEnabled: isEnabled ? 1 : 0, userRole: userRole || null, clientId: Number(clientId), reportPath }
    );
  } else {
    await db.execute(
      `INSERT INTO REPORT_ASSIGNMENTS (USER_ID,MODULE_NAME,MODULE_PATH,REPORT_NAME,REPORT_PATH,IS_ENABLED,USER_ROLE)
       VALUES(:clientId,:moduleName,:modulePath,:reportName,:reportPath,:isEnabled,:userRole)`,
      { clientId: Number(clientId), moduleName: moduleName||'', modulePath: modulePath||'',
        reportName: reportName||'', reportPath, isEnabled: isEnabled ? 1 : 0, userRole: userRole || null }
    );
  }
  res.json({ success: true, message: `Report ${isEnabled ? 'enabled' : 'disabled'}` });
};

// PUT /admin/assignments/flag — toggle PRINT_FLAG or GENERATE_FLAG (stored as 'Y'/'N'),
// upserting the assignment row (defaulted disabled) if it doesn't exist yet.
exports.setAssignmentFlag = async (req, res) => {
  const { clientId, moduleName, modulePath, reportName, reportPath, flag, value } = req.body;
  if (!clientId || !reportPath || !['PRINT', 'GENERATE'].includes(flag))
    return res.status(400).json({ success: false, message: 'clientId, reportPath and a valid flag (PRINT|GENERATE) are required' });

  const column   = flag === 'PRINT' ? 'PRINT_FLAG' : 'GENERATE_FLAG';
  const flagValue = value ? 'Y' : 'N';

  const existing = await db.execute(
    `SELECT ASSIGNMENT_ID FROM REPORT_ASSIGNMENTS WHERE USER_ID=:clientId AND REPORT_PATH=:reportPath`,
    { clientId: Number(clientId), reportPath }
  );
  if (existing.rows.length) {
    await db.execute(
      `UPDATE REPORT_ASSIGNMENTS SET ${column}=:flagValue WHERE USER_ID=:clientId AND REPORT_PATH=:reportPath`,
      { flagValue, clientId: Number(clientId), reportPath }
    );
  } else {
    await db.execute(
      `INSERT INTO REPORT_ASSIGNMENTS (USER_ID,MODULE_NAME,MODULE_PATH,REPORT_NAME,REPORT_PATH,IS_ENABLED,${column})
       VALUES(:clientId,:moduleName,:modulePath,:reportName,:reportPath,0,:flagValue)`,
      { clientId: Number(clientId), moduleName: moduleName || '', modulePath: modulePath || '',
        reportName: reportName || '', reportPath, flagValue }
    );
  }
  res.json({ success: true, message: `${flag} ${flagValue === 'Y' ? 'enabled' : 'disabled'}` });
};

exports.disableAllAssignments = async (req, res) => {
  await db.execute(
    `UPDATE REPORT_ASSIGNMENTS SET IS_ENABLED=0, ASSIGNED_AT=SYSTIMESTAMP WHERE USER_ID=:clientId`,
    { clientId: Number(req.params.clientId) }
  );
  res.json({ success: true, message: 'All reports disabled' });
};

// ── Branch Access ─────────────────────────────────────────────────────────────

exports.getBranches = async (req, res) => {
  const result = await db.execute(
    `SELECT ba.USER_ID, u.NAME AS USER_NAME, ba.BRANCH_CODE
     FROM BRANCH_ACCESS ba
     JOIN USERS u ON ba.USER_ID = u.USER_ID
     ORDER BY u.NAME, ba.BRANCH_CODE`
  );
  res.json({ success: true, data: result.rows });
};

exports.addBranch = async (req, res) => {
  const { userId, code } = req.body;
  if (!userId || !code?.trim())
    return res.status(400).json({ success: false, message: 'User ID and branch code are required' });

  const dup = await db.execute(
    `SELECT USER_ID FROM BRANCH_ACCESS
     WHERE USER_ID=:userId AND UPPER(BRANCH_CODE)=UPPER(:code)`,
    { userId: Number(userId), code: code.trim() }
  );
  if (dup.rows.length)
    return res.status(409).json({ success: false, message: 'This branch code is already assigned to the user' });

  await db.execute(
    `INSERT INTO BRANCH_ACCESS (USER_ID, BRANCH_CODE) VALUES (:userId, :code)`,
    { userId: Number(userId), code: code.trim().toUpperCase() }
  );
  res.status(201).json({ success: true, message: 'Branch access added' });
};

exports.deleteBranch = async (req, res) => {
  const { userId, code } = req.params;
  await db.execute(
    `DELETE FROM BRANCH_ACCESS
     WHERE USER_ID=:userId AND UPPER(BRANCH_CODE)=UPPER(:code)`,
    { userId: Number(userId), code: decodeURIComponent(code) }
  );
  res.json({ success: true, message: 'Branch access removed' });
};

// ── Product Access ────────────────────────────────────────────────────────────

exports.getProducts = async (req, res) => {
  const result = await db.execute(
    `SELECT pa.USER_ID, u.NAME AS USER_NAME, pa.PRODUCT_CODE
     FROM PRODUCT_ACCESS pa
     JOIN USERS u ON pa.USER_ID = u.USER_ID
     ORDER BY u.NAME, pa.PRODUCT_CODE`
  );
  res.json({ success: true, data: result.rows });
};

exports.addProduct = async (req, res) => {
  const { userId, code } = req.body;
  if (!userId || !code?.trim())
    return res.status(400).json({ success: false, message: 'User ID and product code are required' });

  const dup = await db.execute(
    `SELECT USER_ID FROM PRODUCT_ACCESS
     WHERE USER_ID=:userId AND UPPER(PRODUCT_CODE)=UPPER(:code)`,
    { userId: Number(userId), code: code.trim() }
  );
  if (dup.rows.length)
    return res.status(409).json({ success: false, message: 'This product code is already assigned to the user' });

  await db.execute(
    `INSERT INTO PRODUCT_ACCESS (USER_ID, PRODUCT_CODE) VALUES (:userId, :code)`,
    { userId: Number(userId), code: code.trim().toUpperCase() }
  );
  res.status(201).json({ success: true, message: 'Product access added' });
};

exports.deleteProduct = async (req, res) => {
  const { userId, code } = req.params;
  await db.execute(
    `DELETE FROM PRODUCT_ACCESS
     WHERE USER_ID=:userId AND UPPER(PRODUCT_CODE)=UPPER(:code)`,
    { userId: Number(userId), code: decodeURIComponent(code) }
  );
  res.json({ success: true, message: 'Product access removed' });
};
