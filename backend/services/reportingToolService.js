// ============================================================
//  reportingToolService.js
//  Drop-in replacement for bipSoapService.js — same exported function
//  signatures (getModules, getReportsByModule, getFolderContents,
//  resolveReportObjectPath, getReportParameters, runReport,
//  getReportDefinition, FORMAT_MIME, FORMAT_EXT, SUPPORTED_FORMATS), but
//  backed by the ReportingTool project's /api/bip-compat/* REST API instead
//  of real BI Publisher SOAP. Selected at runtime via the admin top-bar
//  "BIP Free" option — see config/reportEngine.js — no other file needs to
//  change.
//
//  Uses ONE shared service-account login (REPORTING_TOOL_USERNAME/PASSWORD),
//  exactly mirroring how bipSoapService.js already uses one shared
//  BIP_USERNAME/BIP_PASSWORD for every request — ReportingTool's own
//  Restriction Mode (set to "External") is what makes per-user restriction
//  enforcement unnecessary on this side; this app already does its own
//  FCUBS-based filtering (applyCoreBankingFilter in clientController.js)
//  before ever getting here.
// ============================================================

const axios = require('axios');

const BASE_URL   = process.env.REPORTING_TOOL_BASE_URL || 'http://localhost:8080';
const RT_USER     = process.env.REPORTING_TOOL_USERNAME;
const RT_PASSWORD = process.env.REPORTING_TOOL_PASSWORD;

let cachedToken = null;

async function login() {
  const res = await axios.post(`${BASE_URL}/api/bip-compat/auth/login`, {
    email: RT_USER,
    password: RT_PASSWORD,
  });
  cachedToken = res.data.token;
  return cachedToken;
}

async function authedRequest(config, allowRetry = true) {
  if (!cachedToken) await login();
  try {
    return await axios({
      ...config,
      baseURL: BASE_URL,
      headers: { ...(config.headers || {}), Authorization: `Bearer ${cachedToken}` },
    });
  } catch (err) {
    if (err.response && err.response.status === 401 && allowRetry) {
      await login();
      return authedRequest(config, false);
    }
    throw err;
  }
}

// ============================================================
//  1.  getFolderContents / getModules / getReportsByModule
// ============================================================

async function getFolderContents(folderAbsolutePath) {
  const path = folderAbsolutePath && folderAbsolutePath !== '/' ? folderAbsolutePath : null;
  const res = path
    ? await authedRequest({ method: 'get', url: '/api/bip-compat/client/modules/reports', params: { path } })
    : await authedRequest({ method: 'get', url: '/api/bip-compat/client/modules' });
  return res.data.data; // already [{displayName, absolutePath, type, description}]
}

// rootPath is ignored: ReportingTool's own top-level listing (Shared / My
// Folder) already IS the top level here — there's no separate
// "/Generic Reports" concept to descend into first, unlike real BIP.
async function getModules(_rootPath) {
  const items = await getFolderContents(null);
  return items.filter((item) => item.type === 'folder');
}

// Real BI Publisher's catalog is flat under a module (Module -> Report, no
// subfolder browsing in between) — bi-report-portal's own frontend assumes
// exactly that shape and has no UI for drilling into a subfolder it's shown
// as if it were a report. ReportingTool's catalog can nest folders
// arbitrarily deep (e.g. "My Folder" -> "OBTR" -> reports), so this
// recursively walks every subfolder under moduleAbsolutePath and flattens
// all reports found anywhere in that subtree into one list, matching the
// flat shape the reference project's UI expects — no changes needed on
// bi-report-portal's side for this.
async function getReportsByModule(moduleAbsolutePath) {
  const items = await getFolderContents(moduleAbsolutePath);
  const reports = items.filter((i) => i.type === 'report');
  const subfolders = items.filter((i) => i.type === 'folder');
  for (const folder of subfolders) {
    const nested = await getReportsByModule(folder.absolutePath);
    reports.push(...nested);
  }
  return reports;
}

// ReportingTool's catalog paths (REPORT_PATH in REPORT_ASSIGNMENTS) are
// already the exact object to run — unlike real BIP there's no separate
// .xdo file living underneath a same-named folder to resolve.
async function resolveReportObjectPath(reportFolderPath) {
  return reportFolderPath;
}

// ============================================================
//  2.  getReportParameters
// ============================================================

async function getReportParameters(reportAbsolutePath, currentParams = []) {
  const res = currentParams.length
    ? await authedRequest({
        method: 'post',
        url: '/api/bip-compat/client/reports/parameters',
        data: { path: reportAbsolutePath, currentParams },
      })
    : await authedRequest({
        method: 'get',
        url: '/api/bip-compat/client/reports/parameters',
        params: { path: reportAbsolutePath },
      });
  return res.data.data;
}

// ============================================================
//  3.  runReport
// ============================================================

const FORMAT_MIME = {
  pdf:  'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls:  'application/vnd.ms-excel',
  html: 'text/html',
  csv:  'text/csv',
  rtf:  'application/rtf',
  xml:  'application/xml',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const FORMAT_EXT = {
  pdf: '.pdf', xlsx: '.xlsx', xls: '.xls', html: '.html',
  csv: '.csv', rtf: '.rtf', xml: '.xml', pptx: '.pptx',
};

async function runReport({
  reportAbsolutePath,
  format     = 'pdf',
  params     = [],
  templateId = '',
  locale     = 'en-US',
  timezone   = 'GMT',
}) {
  const normalizedFormat = format.toLowerCase();
  const res = await authedRequest({
    method: 'post',
    url: '/api/bip-compat/client/reports/run',
    data: { reportPath: reportAbsolutePath, format: normalizedFormat, params, templateId, locale, timezone },
    responseType: 'arraybuffer',
  });
  const buffer      = Buffer.from(res.data);
  const contentType = res.headers['content-type'] || FORMAT_MIME[normalizedFormat] || 'application/octet-stream';
  return { buffer, contentType, fileId: '', locale, ext: FORMAT_EXT[normalizedFormat] || '' };
}

// ============================================================
//  4.  getReportDefinition — not called by clientController.js today;
//      kept only for interface parity with bipSoapService.js.
// ============================================================

async function getReportDefinition(_reportAbsolutePath) {
  throw new Error('getReportDefinition is not implemented against ReportingTool');
}

module.exports = {
  getModules, getReportsByModule, getFolderContents, resolveReportObjectPath,
  getReportParameters, runReport, getReportDefinition,
  FORMAT_MIME, FORMAT_EXT, SUPPORTED_FORMATS: Object.keys(FORMAT_MIME),
};
