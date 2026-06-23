// ============================================================
//  bipSoapService.js
//  Oracle BI Publisher SOAP Service Layer
//  Built against:
//    WSDL-1 (ReportService v2)  – runReport, getReportParameters,
//                                  getReportDefinition
//    WSDL-2 (CatalogService v2) – getFolderContents
//
//  Namespace : http://xmlns.oracle.com/oxp/service/v2
//  Both endpoints use document/literal wrapped SOAP 1.1
// ============================================================

const axios = require('axios');
const { parseStringPromise } = require('xml2js');

// -------------------------------------------------------
//  ENV-DRIVEN CONFIG
//  Set these in your .env file:
//    BIP_BASE_URL      e.g. http://bipserver:9704/xmlpserver
//    BIP_USERNAME      BIP admin / service account
//    BIP_PASSWORD
// -------------------------------------------------------
const BIP_BASE_URL = process.env.BIP_BASE_URL || 'http://localhost:9704/xmlpserver';
const BIP_USER     = process.env.BIP_USERNAME  || 'bipuser';
const BIP_PASS     = process.env.BIP_PASSWORD  || 'bippass';

// WSDL endpoint paths (BIP 11g / 12c)
const REPORT_SERVICE_PATH  = '/services/v2/ReportService';   // WSDL-1
const CATALOG_SERVICE_PATH = '/services/v2/CatalogService';  // WSDL-2

const REPORT_ENDPOINT  = `${BIP_BASE_URL}${REPORT_SERVICE_PATH}`;
const CATALOG_ENDPOINT = `${BIP_BASE_URL}${CATALOG_SERVICE_PATH}`;

const NS = 'http://xmlns.oracle.com/oxp/service/v2';

// -------------------------------------------------------
//  SHARED SOAP HELPER
// -------------------------------------------------------

/**
 * Build a SOAP 1.1 envelope string.
 * @param {string} operation  - WSDL operation name (used as wrapper element)
 * @param {string} bodyXml    - Inner XML content (already namespace-prefixed)
 * @returns {string}
 */
function buildEnvelope(operation, bodyXml) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:v2="${NS}">
  <soapenv:Header/>
  <soapenv:Body>
    <v2:${operation}>
      ${bodyXml}
    </v2:${operation}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * POST a SOAP envelope to the given endpoint and return the parsed response.
 * Throws a structured error on SOAP faults or HTTP errors.
 */
async function postSoap(endpoint, operation, bodyXml) {
  const envelope = buildEnvelope(operation, bodyXml);

  try {
    const response = await axios.post(endpoint, envelope, {
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction':   `""`,
      },
      timeout: 60000,
    });

    const parsed = await parseStringPromise(response.data, {
      explicitArray: false,
      ignoreAttrs:   true,
      tagNameProcessors: [
        // Strip namespace prefixes so we can access fields plainly
        (name) => name.replace(/^.*:/, ''),
      ],
    });

    // Surface SOAP Fault as a real Error
    const fault = parsed?.Envelope?.Body?.Fault;
    if (fault) {
      const msg = fault.faultstring || fault.faultcode || 'SOAP Fault';
      throw new Error(`BIP SOAP Fault [${operation}]: ${msg}`);
    }

    return parsed?.Envelope?.Body;
  } catch (err) {
    if (err.response) {
      // HTTP-level error; try to parse fault from body
      const bodyText = err.response.data || '';
      throw new Error(
        `BIP HTTP ${err.response.status} [${operation}]: ${bodyText.substring(0, 300)}`
      );
    }
    throw err;
  }
}

// -------------------------------------------------------
//  HELPER – escape XML special chars in string values
// -------------------------------------------------------
function xmlEsc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================================
//  1.  getFolderContents  (WSDL-2 – CatalogService)
//
//  Used by:
//    • Admin  → "View Reports" → list modules (top-level folders)
//    • Client → "Generate Report" → list modules assigned to client
//
//  WSDL contract:
//    <element name="getFolderContents">
//      <sequence>
//        <element name="folderAbsolutePath" type="xsd:string"/>
//        <element name="userID"             type="xsd:string"/>
//        <element name="password"           type="xsd:string"/>
//      </sequence>
//    </element>
//
//    Returns: CatalogContents → catalogContents → ArrayOfItemData
//      ItemData fields used here: displayName, absolutePath, type
//      type = "folder"  → module
//      type = "report"  → individual report
// ============================================================

/**
 * Fetch the contents (sub-folders and reports) of a BIP catalog folder.
 *
 * @param {string} folderAbsolutePath  - e.g. "/shared" or "/shared/HR Module"
 * @returns {Promise<Array<{displayName, absolutePath, type}>>}
 */
async function getFolderContents(folderAbsolutePath) {
  const bodyXml = `
    <v2:folderAbsolutePath>${xmlEsc(folderAbsolutePath)}</v2:folderAbsolutePath>
    <v2:userID>${xmlEsc(BIP_USER)}</v2:userID>
    <v2:password>${xmlEsc(BIP_PASS)}</v2:password>`;

  const body = await postSoap(CATALOG_ENDPOINT, 'getFolderContents', bodyXml);

  // Navigate: getFolderContentsResponse → getFolderContentsReturn → catalogContents
  const raw = body?.getFolderContentsResponse?.getFolderContentsReturn?.catalogContents;

  if (!raw) return [];

  // catalogContents is ArrayOfItemData; items may be object or array
  const items = raw.item
    ? Array.isArray(raw.item) ? raw.item : [raw.item]
    : [];

  return items.map((item) => ({
    displayName:  item.displayName  || item.objectName || '',
    absolutePath: item.absolutePath || '',
    type:         (item.type || '').toLowerCase(), // 'folder' | 'report' | 'datamodel'
    description:  item.description  || '',
  }));
}

/**
 * Get only the top-level MODULES (folders) from the BIP shared root.
 * Used by Admin "View Reports" and Client "Generate Report" first screen.
 *
 * @param {string} rootPath - default "/Generic Reports"
 * @returns {Promise<Array<{displayName, absolutePath}>>}
 */
async function getModules(rootPath = '/Generic Reports') {
 const folderContents = await getFolderContents(rootPath);
  
  if (!folderContents) return [];

  // Ensure it's always an array
  const itemsArray = Array.isArray(folderContents) ? folderContents : [folderContents];

  // Filter ONLY for folders (these are your modules like CASA)
  return itemsArray.filter(item => {
    const typeStr = String(item.type || '').toLowerCase();
    return typeStr === 'folder'; 
  });
}

/**
 * Get all REPORTS inside a specific module (folder).
 * Used after a module is clicked, in both Admin and Client panels.
 *
 * @param {string} moduleAbsolutePath - absolute path of the module folder
 * @returns {Promise<Array<{displayName, absolutePath}>>}
 */
async function getReportsByModule(moduleAbsolutePath) {
  const items = await getFolderContents(moduleAbsolutePath);
  return items.filter((i) => i.type === 'report' || i.type === 'xdoreport');
}

// ============================================================
//  2.  getReportParameters  (WSDL-1 – ReportService)
//
//  Used by:
//    • Client → "Generate Report" → parameter form
//
//  WSDL contract:
//    <element name="getReportParameters">
//      <sequence>
//        <element name="reportRequest" type="impl:ReportRequest"/>
//        <element name="userID"        type="xsd:string"/>
//        <element name="password"      type="xsd:string"/>
//      </sequence>
//    </element>
//
//    ReportRequest fields needed for param fetch:
//      reportAbsolutePath, attributeFormat (set to "pdf" as dummy)
//
//    Returns: ParamNameValues → listOfParamNameValues → ArrayOfParamNameValue
//
//    ParamNameValue fields:
//      name                string   – internal parameter name
//      label               string   – display label
//      dataType            string   – "string" | "integer" | "date" | "float"
//      UIType              string   – "text" | "menu" | "date" | "check" | "radio"
//      multiValuesAllowed  boolean  – true → multi-select
//      values              ArrayOfString  – current / default value(s)
//      lovLabels           ArrayOfString  – LOV display labels  (parallel array)
//      defaultValue        string   – single default value
//      dateFormatString    string   – e.g. "MM/dd/yyyy"
//      refreshParamOnChange boolean – cascade trigger
//      selectAll           boolean
//      useNullForAll       boolean
// ============================================================

/**
 * Fetch parameter definitions for a BIP report.
 *
 * @param {string} reportAbsolutePath  - e.g. "/shared/HR Module/Headcount.xdo"
 * @returns {Promise<Array<ParamNameValue>>}
 *
 * Each returned object:
 * {
 *   name, label, dataType, UIType,
 *   multiValuesAllowed, defaultValue,
 *   values: string[],        ← current / default values
 *   lovLabels: string[],     ← LOV display labels (parallel to lovValues)
 *   lovValues: string[],     ← LOV return values  (use values[] from WSDL)
 *   dateFormatString,
 *   refreshParamOnChange, selectAll, useNullForAll
 * }
 */
async function getReportParameters(reportAbsolutePath) {
  // Minimal ReportRequest – just enough to retrieve parameters
  const reportRequestXml = `
    <v2:reportRequest>
      <v2:reportAbsolutePath>${xmlEsc(reportAbsolutePath)}</v2:reportAbsolutePath>
      <v2:attributeFormat>pdf</v2:attributeFormat>
      <v2:byPassCache>true</v2:byPassCache>
      <v2:flattenXML>false</v2:flattenXML>
      <v2:sizeOfDataChunkDownload>-1</v2:sizeOfDataChunkDownload>
    </v2:reportRequest>
    <v2:userID>${xmlEsc(BIP_USER)}</v2:userID>
    <v2:password>${xmlEsc(BIP_PASS)}</v2:password>`;

  const body = await postSoap(REPORT_ENDPOINT, 'getReportParameters', reportRequestXml);

  const raw =
    body?.getReportParametersResponse?.getReportParametersReturn?.listOfParamNameValues;

  if (!raw) return [];

  const items = raw.item
    ? Array.isArray(raw.item) ? raw.item : [raw.item]
    : [];

  return items.map((p) => {
    // values[] and lovLabels[] are ArrayOfString → item[]
    const parseStringArray = (arr) => {
      if (!arr || !arr.item) return [];
      return Array.isArray(arr.item) ? arr.item : [arr.item];
    };

    return {
      name:                  p.name                  || '',
      label:                 p.label                 || p.name || '',
      dataType:              (p.dataType             || 'string').toLowerCase(),
      UIType:                (p.UIType               || 'text').toLowerCase(),
      multiValuesAllowed:    p.multiValuesAllowed === 'true' || p.multiValuesAllowed === true,
      defaultValue:          p.defaultValue          || '',
      dateFormatString:      p.dateFormatString      || 'MM/dd/yyyy',
      refreshParamOnChange:  p.refreshParamOnChange  === 'true',
      selectAll:             p.selectAll             === 'true',
      useNullForAll:         p.useNullForAll         === 'true',
      values:                parseStringArray(p.values),
      lovLabels:             parseStringArray(p.lovLabels),
      // BIP returns lov return-values inside p.values when UIType is menu/check/radio
      // lovLabels is the display side; p.values is the value side for LOV params
    };
  });
}

// ============================================================
//  3.  runReport  (WSDL-1 – ReportService)
//
//  Used by:
//    • Client → "Generate Report" → Run Report button
//
//  WSDL contract:
//    <element name="runReport">
//      <sequence>
//        <element name="reportRequest" type="impl:ReportRequest"/>
//        <element name="userID"        type="xsd:string"/>
//        <element name="password"      type="xsd:string"/>
//      </sequence>
//    </element>
//
//    ReportRequest key fields:
//      reportAbsolutePath  string
//      attributeFormat     string  – "pdf"|"xlsx"|"html"|"csv"|"rtf"|"xml"
//      attributeTemplate   string  – template ID (optional, uses default if omitted)
//      attributeLocale     string  – e.g. "en-US"
//      attributeTimezone   string  – e.g. "Asia/Calcutta"
//      byPassCache         boolean
//      flattenXML          boolean
//      sizeOfDataChunkDownload int  – -1 = return full doc in one shot
//      parameterNameValues → ParamNameValues → listOfParamNameValues → ArrayOfParamNameValue
//        each item:
//          name            string
//          values          ArrayOfString  (use item[] for multi-value)
//          multiValuesAllowed boolean
//          UIType          string
//
//    Returns: ReportResponse
//      reportBytes        base64Binary  – the rendered document
//      reportContentType  string        – MIME type
//      reportFileID       string        – can be used for chunked download
//      reportLocale       string
// ============================================================

/**
 * MIME type map for BIP output formats.
 * Keys match the attributeFormat values BIP accepts.
 */
const FORMAT_MIME = {
  pdf:   'application/pdf',
  xlsx:  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls:   'application/vnd.ms-excel',
  html:  'text/html',
  csv:   'text/csv',
  rtf:   'application/rtf',
  xml:   'application/xml',
  pptx:  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const FORMAT_EXT = {
  pdf:  '.pdf',
  xlsx: '.xlsx',
  xls:  '.xls',
  html: '.html',
  csv:  '.csv',
  rtf:  '.rtf',
  xml:  '.xml',
  pptx: '.pptx',
};

/**
 * Build the parameterNameValues XML block from an array of param objects.
 *
 * @param {Array<{name, values: string[], multiValuesAllowed, UIType}>} params
 * @returns {string}  XML fragment
 */
function buildParamXml(params = []) {
  if (!params.length) return '';

  const items = params
    .map((p) => {
      const valueItems = (p.values || [p.value]).filter(Boolean);
      const valuesXml = valueItems
        .map((v) => `<v2:item>${xmlEsc(v)}</v2:item>`)
        .join('');

      return `
        <v2:item>
          <v2:name>${xmlEsc(p.name)}</v2:name>
          <v2:UIType>${xmlEsc(p.UIType || 'text')}</v2:UIType>
          <v2:dataType>${xmlEsc(p.dataType || 'string')}</v2:dataType>
          <v2:multiValuesAllowed>${p.multiValuesAllowed ? 'true' : 'false'}</v2:multiValuesAllowed>
          <v2:values>${valuesXml}</v2:values>
        </v2:item>`;
    })
    .join('');

  return `
    <v2:parameterNameValues>
      <v2:listOfParamNameValues>
        ${items}
      </v2:listOfParamNameValues>
    </v2:parameterNameValues>`;
}

/**
 * Run a BIP report and return the binary output.
 *
 * @param {object} options
 * @param {string}  options.reportAbsolutePath  – e.g. "/shared/HR/Headcount.xdo"
 * @param {string}  options.format              – "pdf" | "xlsx" | "html" | "csv" | "rtf"
 * @param {Array}   options.params              – [{name, values[], dataType, UIType, multiValuesAllowed}]
 * @param {string}  [options.templateId]        – BIP template ID; omit for default
 * @param {string}  [options.locale]            – e.g. "en-US"  (default "en-US")
 * @param {string}  [options.timezone]          – e.g. "Asia/Calcutta"
 *
 * @returns {Promise<{
 *   buffer:       Buffer,   ← decoded report bytes
 *   contentType:  string,   ← MIME type from BIP
 *   fileId:       string,   ← BIP reportFileID (for chunked download)
 *   locale:       string,
 *   ext:          string,   ← file extension for Content-Disposition
 * }>}
 */
async function runReport({
  reportAbsolutePath,
  format       = 'pdf',
  params       = [],
  templateId   = '',
  locale       = 'en-US',
  timezone     = 'GMT',
}) {
  const normalizedFormat = format.toLowerCase();
  const paramXml         = buildParamXml(params);
  const templateXml      = templateId
    ? `<v2:attributeTemplate>${xmlEsc(templateId)}</v2:attributeTemplate>`
    : '';

  const reportRequestXml = `
    <v2:reportRequest>
      <v2:reportAbsolutePath>${xmlEsc(reportAbsolutePath)}</v2:reportAbsolutePath>
      <v2:attributeFormat>${xmlEsc(normalizedFormat)}</v2:attributeFormat>
      ${templateXml}
      <v2:attributeLocale>${xmlEsc(locale)}</v2:attributeLocale>
      <v2:attributeTimezone>${xmlEsc(timezone)}</v2:attributeTimezone>
      <v2:byPassCache>true</v2:byPassCache>
      <v2:flattenXML>false</v2:flattenXML>
      <v2:sizeOfDataChunkDownload>-1</v2:sizeOfDataChunkDownload>
      ${paramXml}
    </v2:reportRequest>
    <v2:userID>${xmlEsc(BIP_USER)}</v2:userID>
    <v2:password>${xmlEsc(BIP_PASS)}</v2:password>`;

  const body = await postSoap(REPORT_ENDPOINT, 'runReport', reportRequestXml);

  const result = body?.runReportResponse?.runReportReturn;

  if (!result) {
    throw new Error('BIP runReport: empty response – no runReportReturn in body');
  }

  const base64Data = result.reportBytes;
  if (!base64Data) {
    throw new Error('BIP runReport: reportBytes is empty – check report path and parameters');
  }

  const buffer      = Buffer.from(base64Data, 'base64');
  const contentType = result.reportContentType || FORMAT_MIME[normalizedFormat] || 'application/octet-stream';
  const fileId      = result.reportFileID  || '';
  const resLocale   = result.reportLocale  || locale;
  const ext         = FORMAT_EXT[normalizedFormat] || '';

  return { buffer, contentType, fileId, locale: resLocale, ext };
}

// ============================================================
//  4.  getReportDefinition  (WSDL-1 – ReportService)
//
//  Optional utility – used to inspect template IDs and default
//  output format before presenting the run-report UI.
//
//  WSDL contract:
//    <element name="getReportDefinition">
//      <sequence>
//        <element name="reportAbsolutePath" type="xsd:string"/>
//        <element name="userID"             type="xsd:string"/>
//        <element name="password"           type="xsd:string"/>
//      </sequence>
//    </element>
//
//    Returns: ReportDefinition
//      reportName, reportDefnTitle, reportDescription,
//      defaultOutputFormat, defaultTemplateId,
//      templateIds (ArrayOfString),
//      listOfTemplateFormatsLabelValues (per-template format/locale info),
//      reportParameterNameValues (ArrayOfParamNameValue) – same as getReportParameters
// ============================================================

/**
 * Fetch full report definition metadata (templates, default format, description).
 *
 * @param {string} reportAbsolutePath
 * @returns {Promise<{
 *   reportName, title, description,
 *   defaultFormat, defaultTemplateId,
 *   templateIds: string[],
 *   availableFormats: Array<{templateId, formats: Array<{label,value}>}>,
 * }>}
 */
async function getReportDefinition(reportAbsolutePath) {
  const bodyXml = `
    <v2:reportAbsolutePath>${xmlEsc(reportAbsolutePath)}</v2:reportAbsolutePath>
    <v2:userID>${xmlEsc(BIP_USER)}</v2:userID>
    <v2:password>${xmlEsc(BIP_PASS)}</v2:password>`;

  const body = await postSoap(REPORT_ENDPOINT, 'getReportDefinition', bodyXml);

  const def = body?.getReportDefinitionResponse?.getReportDefinitionReturn;
  if (!def) return null;

  // Extract template IDs
  const rawTemplateIds = def.templateIds?.item || [];
  const templateIds = Array.isArray(rawTemplateIds) ? rawTemplateIds : [rawTemplateIds];

  // Extract per-template format options
  const rawTemplates = def.listOfTemplateFormatsLabelValues?.item || [];
  const templates    = Array.isArray(rawTemplates) ? rawTemplates : [rawTemplates];

  const availableFormats = templates.map((t) => {
    const rawFmts = t.listOfTemplateFormatLabelValue?.item || [];
    const fmts    = Array.isArray(rawFmts) ? rawFmts : [rawFmts];
    return {
      templateId: t.templateID || '',
      active:     t.active === 'true',
      isDefault:  t.default === 'true',
      formats: fmts.map((f) => ({
        label: f.templateFormatLabel || '',
        value: f.templateFormatValue || '',
      })),
    };
  });

  return {
    reportName:        def.reportName        || '',
    title:             def.reportDefnTitle   || def.reportName || '',
    description:       def.reportDescription || '',
    defaultFormat:     def.defaultOutputFormat || 'pdf',
    defaultTemplateId: def.defaultTemplateId   || '',
    templateIds,
    availableFormats,
  };
}

// ============================================================
//  MODULE EXPORTS
// ============================================================
module.exports = {
  // Core operations used by API routes
  getModules,            // Admin + Client: list modules from BIP root
  getReportsByModule,    // Admin + Client: list reports in a module
  getFolderContents,     // Low-level: list any folder (folder + report items)
  getReportParameters,   // Client: get parameter definitions for a report
  runReport,             // Client: execute a report, return buffer + metadata
  getReportDefinition,   // Optional: get template/format metadata for a report

  // Exported constants (useful in controllers for format validation)
  FORMAT_MIME,
  FORMAT_EXT,
  SUPPORTED_FORMATS: Object.keys(FORMAT_MIME),
};
