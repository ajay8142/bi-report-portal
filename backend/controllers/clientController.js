// backend/controllers/clientController.js
const db  = require('../config/db');
const bip = require('../services/bipSoapService');

exports.getProfile = async (req, res) => {
  const result = await db.execute(
    `SELECT USER_ID, NAME, EMAIL, ROLE, CREATED_AT FROM USERS WHERE USER_ID = :id`,
    { id: req.user.userId }
  );
  if (!result.rows.length)
    return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: result.rows[0] });
};

exports.getModules = async (req, res) => {
  const userId = req.user.userId;
  const dbResult = await db.execute(
    `SELECT DISTINCT MODULE_PATH, MODULE_NAME FROM REPORT_ASSIGNMENTS
     WHERE USER_ID = :userId AND IS_ENABLED = 1`,
    { userId }
  );
  const assignedPaths = new Set(dbResult.rows.map(r => r.MODULE_PATH));
  if (!assignedPaths.size) return res.json({ success: true, data: [] });
  const allModules = await bip.getModules('/shared');
  res.json({ success: true, data: allModules.filter(m => assignedPaths.has(m.absolutePath)) });
};

exports.getReports = async (req, res) => {
  const { path } = req.query;
  const userId   = req.user.userId;
  if (!path) return res.status(400).json({ success: false, message: 'path is required' });

  const dbResult = await db.execute(
    `SELECT REPORT_PATH FROM REPORT_ASSIGNMENTS
     WHERE USER_ID = :userId AND MODULE_PATH = :modulePath AND IS_ENABLED = 1`,
    { userId, modulePath: path }
  );
  const assigned = new Set(dbResult.rows.map(r => r.REPORT_PATH));
  if (!assigned.size) return res.json({ success: true, data: [] });
  const allReports = await bip.getReportsByModule(path);
  res.json({ success: true, data: allReports.filter(r => assigned.has(r.absolutePath)) });
};

exports.getParameters = async (req, res) => {
  const { reportPath } = req.query;
  const userId = req.user.userId;
  if (!reportPath) return res.status(400).json({ success: false, message: 'reportPath is required' });

  const check = await db.execute(
    `SELECT ASSIGNMENT_ID FROM REPORT_ASSIGNMENTS
     WHERE USER_ID = :userId AND REPORT_PATH = :reportPath AND IS_ENABLED = 1`,
    { userId, reportPath }
  );
  if (!check.rows.length)
    return res.status(403).json({ success: false, message: 'Access denied to this report' });

  const params = await bip.getReportParameters(reportPath);
  res.json({ success: true, data: params });
};

exports.runReport = async (req, res) => {
  const { reportPath, format, params, templateId, locale, timezone, action } = req.body;
  const userId = req.user.userId;
  if (!reportPath || !format)
    return res.status(400).json({ success: false, message: 'reportPath and format are required' });
  if (!bip.SUPPORTED_FORMATS.includes(format.toLowerCase()))
    return res.status(400).json({ success: false, message: `Allowed formats: ${bip.SUPPORTED_FORMATS.join(', ')}` });

  const check = await db.execute(
    `SELECT ASSIGNMENT_ID FROM REPORT_ASSIGNMENTS
     WHERE USER_ID = :userId AND REPORT_PATH = :reportPath AND IS_ENABLED = 1`,
    { userId, reportPath }
  );
  if (!check.rows.length)
    return res.status(403).json({ success: false, message: 'Access denied to this report' });

  const result = await bip.runReport({
    reportAbsolutePath: reportPath,
    format, params: params || [],
    templateId: templateId || '',
    locale: locale || 'en-US',
    timezone: timezone || 'Asia/Calcutta',
  });

  await db.execute(
    `INSERT INTO AUDIT_LOGS (USER_ID, ACTION, DETAILS, IP_ADDRESS)
     VALUES (:userId, 'RUN_REPORT', :details, :ip)`,
    { userId, details: JSON.stringify({ reportPath, format }), ip: req.ip || '' }
  );

  const disposition = action === 'preview' ? 'inline' : 'attachment';
  const filename = reportPath.split('/').pop().replace('.xdo', '') + result.ext;
  res.set('Content-Type', result.contentType);
  res.set('Content-Disposition', `${disposition}; filename="${filename}"`);
  res.set('Content-Length', result.buffer.length);
  res.send(result.buffer);
};
