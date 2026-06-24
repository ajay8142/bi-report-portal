const db  = require('../config/db');
const bip = require('../services/bipSoapService');

// --- Helper to format Oracle .xdo paths ---
// Converts: "/Generic Reports/CASA/Dormant Accounts"
// To:       "/Generic Reports/CASA/Dormant Accounts/Dormant_Accounts.xdo"
function formatOraclePath(basePath) {
  if (basePath.endsWith('.xdo')) return basePath;
  
  // Extract the last folder name (e.g., "Dormant Accounts")
  const parts = basePath.split('/');
  const folderName = parts[parts.length - 1];
  
  // Replace spaces with underscores for the file name (e.g., "Dormant_Accounts")
  const fileName = folderName.replace(/ /g, '_');
  
  return `${basePath}/${fileName}.xdo`;
}

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
  const allModules = await bip.getModules('/Generic Reports');
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
  const rawPath = req.query.path || req.query.reportPath;
  const userId = req.user.userId;

  if (!rawPath) return res.status(400).json({ success: false, message: 'report path is required' });

  const check = await db.execute(
    `SELECT ASSIGNMENT_ID FROM REPORT_ASSIGNMENTS
     WHERE USER_ID = :userId AND REPORT_PATH = :reportPath AND IS_ENABLED = 1`,
    { userId, reportPath: rawPath }
  );

  if (!check.rows.length)
    return res.status(403).json({ success: false, message: 'Access denied to this report' });

  const oraclePath = formatOraclePath(rawPath);

  try {
    const params = await bip.getReportParameters(oraclePath);
    res.json({ success: true, data: params });
  } catch (err) {
    console.error("🚨 Parameter Fetch Error:", err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch parameters' });
  }
};

// POST /reports/parameters — same as GET but also passes current param values
// so BIP can return refreshed LOV options for dependent parameters
exports.refreshParameters = async (req, res) => {
  const { path: rawPath, currentParams = [] } = req.body;
  const userId = req.user.userId;

  if (!rawPath) return res.status(400).json({ success: false, message: 'path is required' });

  const check = await db.execute(
    `SELECT ASSIGNMENT_ID FROM REPORT_ASSIGNMENTS
     WHERE USER_ID = :userId AND REPORT_PATH = :reportPath AND IS_ENABLED = 1`,
    { userId, reportPath: rawPath }
  );

  if (!check.rows.length)
    return res.status(403).json({ success: false, message: 'Access denied to this report' });

  const oraclePath = formatOraclePath(rawPath);

  try {
    const params = await bip.getReportParameters(oraclePath, currentParams);
    res.json({ success: true, data: params });
  } catch (err) {
    console.error("🚨 Parameter Refresh Error:", err.message);
    res.status(500).json({ success: false, message: 'Failed to refresh parameters' });
  }
};

exports.runReport = async (req, res) => {
  const { reportPath, format, params, templateId, locale, timezone, action } = req.body;
  const userId = req.user.userId;
  
  if (!reportPath || !format)
    return res.status(400).json({ success: false, message: 'reportPath and format are required' });
    
  if (!bip.SUPPORTED_FORMATS.includes(format.toLowerCase()))
    return res.status(400).json({ success: false, message: `Allowed formats: ${bip.SUPPORTED_FORMATS.join(', ')}` });

  // 1. Check DB using the exact path
  const check = await db.execute(
    `SELECT ASSIGNMENT_ID FROM REPORT_ASSIGNMENTS
     WHERE USER_ID = :userId AND REPORT_PATH = :reportPath AND IS_ENABLED = 1`,
    { userId, reportPath }
  );
  
  if (!check.rows.length)
    return res.status(403).json({ success: false, message: 'Access denied to this report' });

  // 2. Reformat the path for Oracle SOAP Service
  const oraclePath = formatOraclePath(reportPath);
  console.log(oraclePath);

  try {
    const result = await bip.runReport({
      reportAbsolutePath: oraclePath,
      format, params: params || [],
      templateId: templateId || '',
      locale: locale || 'en-US',
      timezone: timezone || 'Asia/Calcutta',
    });

    const reportName = reportPath.split('/').pop(); // Use the clean path name for the report name
    await db.execute(
      `INSERT INTO AUDIT_LOGS (USER_ID, REPORT_NAME, ACTION, FORMAT)
       VALUES (:userId, :reportName, :action, :format)`,
      { userId, reportName, action: action || 'download', format: format.toUpperCase() }
    );

    const disposition = action === 'preview' ? 'inline' : 'attachment';
    const filename = oraclePath.split('/').pop().replace('.xdo', '') + result.ext;
    
    res.set('Content-Type', result.contentType);
    res.set('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.set('Content-Length', result.buffer.length);
    res.send(result.buffer);
  } catch (err) {
    console.error("🚨 Run Report Error:", err.message);
    res.status(500).json({ success: false, message: 'Failed to run report' });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await db.execute(
      `SELECT LOG_ID, REPORT_NAME, ACTION, FORMAT, CREATED_AT
       FROM AUDIT_LOGS
       WHERE USER_ID = :userId
       ORDER BY CREATED_AT DESC
       FETCH FIRST 200 ROWS ONLY`,
      { userId }
    );

    const history = result.rows.map(row => ({
      LOG_ID:      row.LOG_ID,
      REPORT_NAME: row.REPORT_NAME,
      ACTION:      row.ACTION,
      FORMAT:      row.FORMAT,
      CREATED_AT:  row.CREATED_AT,
    }));

    res.json({ success: true, data: history });
  } catch (error) {
    console.error("🚨 History Fetch Error:", error);
    res.status(500).json({ success: false, message: 'Failed to fetch history' });
  }
};