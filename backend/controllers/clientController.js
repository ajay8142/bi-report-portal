const db  = require('../config/db');
const bip = require('../services/bipSoapService');

// Extracts the client's IP, unwrapping the IPv6-mapped IPv4 prefix (::ffff:) Node adds
// when a client connects over IPv4.
function getClientIp(req) {
  const ip = req.ip || req.socket?.remoteAddress || '';
  return ip.replace(/^::ffff:/, '');
}

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]+$/;

// req.ip resolves to a loopback/private address (::1, 127.0.0.1) when the server is behind
// NAT or accessed via localhost, so prefer the public IP the frontend looked up client-side.
function resolveClientIp(req, reportedIp) {
  if (reportedIp && IP_RE.test(reportedIp)) return reportedIp;
  const fallback = getClientIp(req);
  console.warn(`IP lookup: frontend reported no usable IP (got "${reportedIp}"), using server-side fallback "${fallback}"`);
  return fallback;
}

// Report parameters that must be restricted to the values a user is
// authorized for in the core banking (FCUBS) tables, keyed by USER_NAME.
// BRANCH is resolved via the FCUBS restriction package (role-aware); the rest
// read straight off the SMTB access tables.
const CORE_BANKING_FILTERS = [
  { test: label => label.includes('BRANCH'), fn: 'PKG_USER_REPORT_RESTRICTION.GET_ALLOWED_BRANCHES' },
  // PRODUCT_CODE is also scoped by the report's PM_MODULE parameter.
  { test: label => label.includes('PRODUCT'), fn: 'PKG_USER_REPORT_RESTRICTION.GET_ALLOWED_PRODUCT_CODE', needsModule: true },
  { test: label => label.includes('ACCOUNT') && label.includes('CLASS'), fn: 'PKG_USER_REPORT_RESTRICTION.GET_ALLOWED_ACCOUNT_CLASSES' },
  { test: label => label.includes('GL') && label.includes('CODE'), fn: 'PKG_USER_REPORT_RESTRICTION.GET_ALLOWED_GLS' },
];

async function applyCoreBankingFilter(userId, userRole, params) {
  try {
    const userResult = await db.execute(`SELECT USER_NAME FROM USERS WHERE USER_ID = :userId`, { userId });
    const userName = userResult.rows[0]?.USER_NAME;
    if (!userName) return params;

    const moduleParam = params.find(p => (p.name || '').toUpperCase() === 'PM_MODULE');
    const moduleValue = moduleParam?.values?.[0] ?? moduleParam?.defaultValue ?? null;

    const allowedCache = {};
    const result = [];

    for (const param of params) {
      const label   = (param.label || param.name || '').toUpperCase();
      const matcher = CORE_BANKING_FILTERS.find(m => m.test(label));
      if (!matcher) { result.push(param); continue; }

      const cacheKey = (matcher.fn || matcher.table) + (matcher.needsModule ? `:${moduleValue || ''}` : '');
      if (!allowedCache[cacheKey]) {
        const bindParams = { userName, userRole: userRole || null };
        let fnArgs = ':userName, :userRole';
        if (matcher.needsModule) {
          bindParams.pmModule = moduleValue;
          fnArgs += ', :pmModule';
        }
        const rows = matcher.fn
          ? await db.execute(
              `SELECT COLUMN_VALUE AS VAL FROM TABLE(${matcher.fn}(${fnArgs}))`,
              bindParams
            )
          : await db.execute(
              `SELECT DISTINCT ${matcher.column} AS VAL FROM ${matcher.table} WHERE USER_ID = :userName ${matcher.where}`,
              { userName }
            );
        allowedCache[cacheKey] = new Set(rows.rows.map(r => String(r.VAL).toUpperCase()));
      }

      const allowedSet = allowedCache[cacheKey];
      if (!allowedSet.size) { result.push(param); continue; }

      const lovValues = param.values    || [];
      const lovLabels = param.lovLabels || [];

      // GL_CODE (and any other restricted param) may not come from BIP as an LOV at all —
      // in that case build the dropdown entirely from the restriction package's allowed values.
      const kept = lovValues.length
        ? lovValues
            .map((v, i) => ({ v, label: lovLabels[i] ?? v }))
            .filter(({ v }) => allowedSet.has(String(v).toUpperCase()))
        : [...allowedSet].sort().map(v => ({ v, label: v }));

      result.push({
        ...param,
        UIType: kept.length ? 'menu' : param.UIType,
        values: kept.map(x => x.v),
        lovLabels: kept.map(x => x.label),
      });
    }
    return result;
  } catch (err) {
    console.error('Core banking access filter error:', err.message);
    return params;
  }
}

// --- Resolve a report's .xdo object path ---
// REPORT_PATH is stored as the catalog folder, e.g. "/Generic Reports/CASA/Dormant Accounts".
// Ask BIP what the actual report object inside that folder is instead of guessing the file name.
async function resolveOraclePath(basePath) {
  if (basePath.endsWith('.xdo')) return basePath;
  return bip.resolveReportObjectPath(basePath);
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
    `SELECT REPORT_PATH, PRINT_FLAG, GENERATE_FLAG FROM REPORT_ASSIGNMENTS
     WHERE USER_ID = :userId AND MODULE_PATH = :modulePath AND IS_ENABLED = 1`,
    { userId, modulePath: path }
  );
  const assignedMap = new Map(dbResult.rows.map(r => [
    r.REPORT_PATH,
    { printFlag: r.PRINT_FLAG === 'Y', generateFlag: r.GENERATE_FLAG === 'Y' },
  ]));
  if (!assignedMap.size) return res.json({ success: true, data: [] });
  const allReports = await bip.getReportsByModule(path);
  const data = allReports
    .filter(r => assignedMap.has(r.absolutePath))
    .map(r => ({ ...r, ...assignedMap.get(r.absolutePath) }));
  res.json({ success: true, data });
};

exports.getParameters = async (req, res) => {
  const rawPath = req.query.path || req.query.reportPath;
  const userId = req.user.userId;

  if (!rawPath) return res.status(400).json({ success: false, message: 'report path is required' });

  const check = await db.execute(
    `SELECT ASSIGNMENT_ID, USER_ROLE FROM REPORT_ASSIGNMENTS
     WHERE USER_ID = :userId AND REPORT_PATH = :reportPath AND IS_ENABLED = 1`,
    { userId, reportPath: rawPath }
  );

  if (!check.rows.length)
    return res.status(403).json({ success: false, message: 'Access denied to this report' });

  try {
    const oraclePath = await resolveOraclePath(rawPath);
    const params   = await bip.getReportParameters(oraclePath);
    const filtered = await applyCoreBankingFilter(userId, check.rows[0].USER_ROLE, params);
    res.json({ success: true, data: filtered });
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
    `SELECT ASSIGNMENT_ID, USER_ROLE FROM REPORT_ASSIGNMENTS
     WHERE USER_ID = :userId AND REPORT_PATH = :reportPath AND IS_ENABLED = 1`,
    { userId, reportPath: rawPath }
  );

  if (!check.rows.length)
    return res.status(403).json({ success: false, message: 'Access denied to this report' });

  try {
    const oraclePath = await resolveOraclePath(rawPath);
    const params   = await bip.getReportParameters(oraclePath, currentParams);
    const filtered = await applyCoreBankingFilter(userId, check.rows[0].USER_ROLE, params);
    res.json({ success: true, data: filtered });
  } catch (err) {
    console.error("🚨 Parameter Refresh Error:", err.message);
    res.status(500).json({ success: false, message: 'Failed to refresh parameters' });
  }
};

exports.runReport = async (req, res) => {
  const { reportPath, format, params, templateId, locale, timezone, action, clientIp } = req.body;
  const userId = req.user.userId;
  
  if (!reportPath || !format)
    return res.status(400).json({ success: false, message: 'reportPath and format are required' });
    
  if (!bip.SUPPORTED_FORMATS.includes(format.toLowerCase()))
    return res.status(400).json({ success: false, message: `Allowed formats: ${bip.SUPPORTED_FORMATS.join(', ')}` });

  // 1. Check DB using the exact path
  const check = await db.execute(
    `SELECT ASSIGNMENT_ID, USER_ROLE FROM REPORT_ASSIGNMENTS
     WHERE USER_ID = :userId AND REPORT_PATH = :reportPath AND IS_ENABLED = 1`,
    { userId, reportPath }
  );

  if (!check.rows.length)
    return res.status(403).json({ success: false, message: 'Access denied to this report' });

  const userRole = check.rows[0].USER_ROLE;

  try {
    // 2. Resolve the actual .xdo report object for the Oracle SOAP Service
    const oraclePath = await resolveOraclePath(reportPath);

    const userResult = await db.execute(`SELECT USER_NAME FROM USERS WHERE USER_ID = :userId`, { userId });
    const userName = userResult.rows[0]?.USER_NAME;

    let finalParams = params || [];
    if (userName) {
      const idx = finalParams.findIndex(p => (p.name || '').toUpperCase() === 'PM_USER_ID');
      const pmUserIdParam = { name: 'PM_USER_ID', dataType: 'string', values: [userName] };
      finalParams = idx >= 0
        ? finalParams.map((p, i) => i === idx ? { ...p, values: [userName] } : p)
        : [...finalParams, pmUserIdParam];
    }
    if (userRole) {
      const roleIdx = finalParams.findIndex(p => (p.name || '').toUpperCase() === 'PM_ROLE_ID');
      const pmRoleIdParam = { name: 'PM_ROLE_ID', dataType: 'string', values: [userRole] };
      finalParams = roleIdx >= 0
        ? finalParams.map((p, i) => i === roleIdx ? { ...p, values: [userRole] } : p)
        : [...finalParams, pmRoleIdParam];
    }

    const result = await bip.runReport({
      reportAbsolutePath: oraclePath,
      format, params: finalParams,
      templateId: templateId || '',
      locale: locale || 'en-US',
      timezone: timezone || 'Asia/Calcutta',
    });

    const reportName = reportPath.split('/').pop(); // Use the clean path name for the report name
    const auditAction = action === 'preview' ? 'GENERATE' : 'PRINT';
    await db.execute(
      `INSERT INTO AUDIT_LOGS (USER_ID, REPORT_NAME, ACTION, FORMAT, IP_ADDRESS)
       VALUES (:userId, :reportName, :action, :format, :ipAddress)`,
      { userId, reportName, action: auditAction, format: format.toUpperCase(), ipAddress: resolveClientIp(req, clientIp) }
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
    res.set('Cache-Control', 'no-store');
    const userId = req.user.userId;
    const result = await db.execute(
      `SELECT LOG_ID, REPORT_NAME, ACTION, FORMAT, IP_ADDRESS, CREATED_AT
       FROM AUDIT_LOGS
       WHERE USER_ID = :userId
       ORDER BY CREATED_AT DESC
       FETCH FIRST 200 ROWS ONLY`,
      { userId }
    );

    console.log(`AUDIT_LOGS: user ${userId} -> ${result.rows.length} rows, LOG_IDs: ${result.rows.map(r => r.LOG_ID).join(',')}`);

    const history = result.rows.map(row => ({
      LOG_ID:      row.LOG_ID,
      REPORT_NAME: row.REPORT_NAME,
      ACTION:      row.ACTION,
      FORMAT:      row.FORMAT,
      IP_ADDRESS:  row.IP_ADDRESS,
      CREATED_AT:  row.CREATED_AT,
    }));

    res.json({ success: true, data: history });
  } catch (error) {
    console.error("🚨 History Fetch Error:", error);
    res.status(500).json({ success: false, message: 'Failed to fetch history' });
  }
};