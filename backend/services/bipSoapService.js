// ============================================================
//  bipSoapService.js
//  Oracle BI Publisher SOAP Service Layer
// ============================================================

const axios = require('axios');
const https = require('https');
const { parseStringPromise } = require('xml2js');

const BIP_BASE_URL = process.env.BIP_BASE_URL ;
const BIP_USER     = process.env.BIP_USERNAME ;
const BIP_PASS     = process.env.BIP_PASSWORD ;

const REPORT_SERVICE_PATH  = '/services/v2/ReportService';
const CATALOG_SERVICE_PATH = '/services/v2/CatalogService';

const REPORT_ENDPOINT  = `${BIP_BASE_URL}${REPORT_SERVICE_PATH}`;
const CATALOG_ENDPOINT = `${BIP_BASE_URL}${CATALOG_SERVICE_PATH}`;

const NS = 'http://xmlns.oracle.com/oxp/service/v2';

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
      tagNameProcessors: [(name) => name.replace(/^.*:/, '')],
    });
    const fault = parsed?.Envelope?.Body?.Fault;
    if (fault) {
      const msg = fault.faultstring || fault.faultcode || 'SOAP Fault';
      throw new Error(`BIP SOAP Fault [${operation}]: ${msg}`);
    }
    return parsed?.Envelope?.Body;
  } catch (err) {
    if (err.response) {
      const bodyText = typeof err.response.data === 'string'
        ? err.response.data
        : JSON.stringify(err.response.data);
      // Extract the SOAP faultstring for a readable error; log full body for debugging
      const faultMatch = bodyText.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i);
      const faultMsg   = faultMatch ? faultMatch[1].trim() : bodyText.substring(0, 500);
      console.error(`\n--- BIP SOAP ERROR [${operation}] HTTP ${err.response.status} ---\n${bodyText.substring(0, 3000)}\n---`);
      throw new Error(`BIP [${operation}] ${faultMsg}`);
    }
    throw err;
  }
}

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
// ============================================================

async function getFolderContents(folderAbsolutePath) {
  const bodyXml = `
    <v2:folderAbsolutePath>${xmlEsc(folderAbsolutePath)}</v2:folderAbsolutePath>
    <v2:userID>${xmlEsc(BIP_USER)}</v2:userID>
    <v2:password>${xmlEsc(BIP_PASS)}</v2:password>`;
  const body = await postSoap(CATALOG_ENDPOINT, 'getFolderContents', bodyXml);
  const raw = body?.getFolderContentsResponse?.getFolderContentsReturn?.catalogContents;
  if (!raw) return [];
  const items = raw.item ? Array.isArray(raw.item) ? raw.item : [raw.item] : [];
  return items.map((item) => ({
    displayName:  item.displayName  || item.objectName || '',
    absolutePath: item.absolutePath || '',
    type:         (item.type || '').toLowerCase(),
    description:  item.description  || '',
  }));
}

async function getModules(rootPath = '/Generic Reports') {
 const folderContents = await getFolderContents(rootPath);
  if (!folderContents) return [];
  const itemsArray = Array.isArray(folderContents) ? folderContents : [folderContents];
  return itemsArray.filter(item => {
    const typeStr = String(item.type || '').toLowerCase();
    return typeStr === 'folder'; 
  });
}

async function getReportsByModule(moduleAbsolutePath) {
  const items = await getFolderContents(moduleAbsolutePath);
  return items;
}

// ============================================================
//  2.  getReportParameters  (WSDL-1 – ReportService)
// ============================================================

// Pass currentParams to get refreshed LOV options for dependent parameters
async function getReportParameters(reportAbsolutePath, currentParams = []) {
  const paramXml = buildParamXml(currentParams);
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:v2="http://xmlns.oracle.com/oxp/service/v2">
   <soapenv:Header/>
   <soapenv:Body>
      <v2:getReportParameters>
         <v2:reportRequest>
            <v2:reportAbsolutePath>${xmlEsc(reportAbsolutePath)}</v2:reportAbsolutePath>
            <v2:attributeFormat>pdf</v2:attributeFormat>
            <v2:byPassCache>true</v2:byPassCache>
            <v2:flattenXML>false</v2:flattenXML>
            <v2:sizeOfDataChunkDownload>-1</v2:sizeOfDataChunkDownload>
            ${paramXml}
         </v2:reportRequest>
         <v2:userID>${xmlEsc(BIP_USER)}</v2:userID>
         <v2:password>${xmlEsc(BIP_PASS)}</v2:password>
      </v2:getReportParameters>
   </soapenv:Body>
</soapenv:Envelope>`;

  try {
    const response = await axios.post(REPORT_ENDPOINT, xmlPayload, {
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': '""'
      },
      timeout: 10000
    });

    const parsed = await parseStringPromise(response.data, {
      explicitArray: false,
      ignoreAttrs: true,
      tagNameProcessors: [(name) => name.replace(/^.*:/, '')]
    });

    const raw = parsed?.Envelope?.Body?.getReportParametersResponse?.getReportParametersReturn?.listOfParamNameValues;
    if (!raw) return [];

    const items = raw.item ? (Array.isArray(raw.item) ? raw.item : [raw.item]) : [];

    return items.map((p) => {
      const parseStringArray = (arr) => {
        if (!arr || !arr.item) return [];
        return Array.isArray(arr.item) ? arr.item : [arr.item];
      };

      const useNullForAll = p.useNullForAll === 'true' || p.useNullForAll === true;
      const hasDefault = !!p.defaultValue;

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
        useNullForAll:         useNullForAll,
        // A parameter is considered mandatory if it's not optional (useNullForAll=false)
        // and it doesn't have a default value to fall back on.
        mandatory:             !useNullForAll && !hasDefault,
        values:                parseStringArray(p.values),
        lovLabels:             parseStringArray(p.lovLabels),
      };
    });
  } catch (err) {
    console.error("🚨 Parameter Soap Error:", err.message);
    throw new Error('Failed to fetch parameters');
  }
}

// ============================================================
//  3.  runReport  (WSDL-1 – ReportService)
// ============================================================

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

// Converts an ISO date string (YYYY-MM-DD) to the format BIP expects,
// using the Java-style dateFormatString from the parameter definition.
function formatDateByPattern(isoDate, pattern) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [year, mon, day] = isoDate.split('-');
  const mIdx = parseInt(mon, 10) - 1;
  const ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const FULL = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  return (pattern || 'MM/dd/yyyy').replace(/yyyy|yy|MMMM|MMM|MM|M|dd|d/g, (t) => {
    if (t === 'yyyy') return year;
    if (t === 'yy')   return year.slice(-2);
    if (t === 'MMMM') return FULL[mIdx] || mon;
    if (t === 'MMM')  return ABBR[mIdx] || mon;
    if (t === 'MM')   return mon;
    if (t === 'M')    return String(parseInt(mon, 10));
    if (t === 'dd')   return day;
    if (t === 'd')    return String(parseInt(day, 10));
    return t;
  });
}

/**
 * Build the parameterNameValues XML block.
 * Generates the exact XML structure verified via Postman.
 */
function buildParamXml(params = []) {
  if (!params.length) return '';

  const items = params
    .map((p) => {
      // The frontend ensures p.values is an array. Filter out any blank/null values.
      const valueItems = (p.values || []).filter(v => v !== null && v !== undefined && v !== '');

      // If `useNullForAll` is true and the user selected no values, BIP expects us to
      // omit the parameter entirely from the request. This makes it use the "All" default.
      // The frontend now passes the `useNullForAll` flag for this check.
      if (p.useNullForAll && valueItems.length === 0) {
        return ''; // Skip this parameter
      }

      const isTrueDate = p.dataType === 'date';
      const isStringDate = !isTrueDate && p.UIType === 'date';

      const valuesXml = valueItems.map((v) => {
        let formattedValue = v;

        if (isTrueDate && v) {
          // For true 'date' types, BIP expects an ISO 8601 dateTime string.
          // The input 'v' is YYYY-MM-DD from the date picker.
          const parts = String(v).split('T')[0].split('-');
          if (parts.length === 3) {
            const [yyyy, mm, dd] = parts;
            // Format to ISO 8601 DateTime with UTC timezone. This is more robust than a hardcoded offset.
            formattedValue = `${yyyy}-${mm}-${dd}T00:00:00.000+00:00`;
          }
        } else if (isStringDate && v) {
          // For string types that are dates, format them using the pattern from the report definition.
          // The input 'v' is YYYY-MM-DD.
          formattedValue = formatDateByPattern(v, p.dateFormatString);
        }

        return `<v2:item>${xmlEsc(formattedValue)}</v2:item>`;
      }).join('');

      // Build the parameter properties dynamically
      let propsXml = `<v2:name>${xmlEsc(p.name)}</v2:name>`;

      if (p.multiValuesAllowed) {
        propsXml += `\n          <v2:multiValuesAllowed>true</v2:multiValuesAllowed>`;
      }

      // Pass the dataType as-is. Don't force 'date' for string-based dates.
      // BIP only needs this for non-string types like 'date', 'integer', etc.
      if (p.dataType && p.dataType !== 'string') {
        propsXml += `\n          <v2:dataType>${xmlEsc(p.dataType)}</v2:dataType>`;
      }

      return `
        <v2:item>
          ${propsXml}
          <v2:values>
            ${valuesXml}
          </v2:values>
        </v2:item>`;
    })
    .filter(Boolean) // Remove any empty strings from skipped parameters
    .join('');

  if (!items) return '';

  return `
    <v2:parameterNameValues>
      <v2:listOfParamNameValues>
        ${items}
      </v2:listOfParamNameValues>
    </v2:parameterNameValues>`;
}

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
  const templateXml      = templateId ? `<v2:attributeTemplate>${xmlEsc(templateId)}</v2:attributeTemplate>` : '';

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

  if (!result) throw new Error('BIP runReport: empty response');
  
  const base64Data = result.reportBytes;
  if (!base64Data) throw new Error('BIP runReport: reportBytes is empty');

  const buffer      = Buffer.from(base64Data, 'base64');
  const contentType = result.reportContentType || FORMAT_MIME[normalizedFormat] || 'application/octet-stream';
  const fileId      = result.reportFileID  || '';
  const resLocale   = result.reportLocale  || locale;
  const ext         = FORMAT_EXT[normalizedFormat] || '';

  return { buffer, contentType, fileId, locale: resLocale, ext };
}

// ============================================================
//  4.  getReportDefinition  (WSDL-1 – ReportService)
// ============================================================

async function getReportDefinition(reportAbsolutePath) {
  const bodyXml = `
    <v2:reportAbsolutePath>${xmlEsc(reportAbsolutePath)}</v2:reportAbsolutePath>
    <v2:userID>${xmlEsc(BIP_USER)}</v2:userID>
    <v2:password>${xmlEsc(BIP_PASS)}</v2:password>`;
  const body = await postSoap(REPORT_ENDPOINT, 'getReportDefinition', bodyXml);
  const def = body?.getReportDefinitionResponse?.getReportDefinitionReturn;
  if (!def) return null;

  const rawTemplateIds = def.templateIds?.item || [];
  const templateIds = Array.isArray(rawTemplateIds) ? rawTemplateIds : [rawTemplateIds];

  const rawTemplates = def.listOfTemplateFormatsLabelValues?.item || [];
  const templates    = Array.isArray(rawTemplates) ? rawTemplates : [rawTemplates];

  const availableFormats = templates.map((t) => {
    const rawFmts = t.listOfTemplateFormatLabelValue?.item || [];
    const fmts    = Array.isArray(rawFmts) ? rawFmts : [rawFmts];
    return {
      templateId: t.templateID || '',
      active:     t.active === 'true',
      isDefault:  t.default === 'true',
      formats: fmts.map((f) => ({ label: f.templateFormatLabel || '', value: f.templateFormatValue || '' })),
    };
  });

  return {
    reportName:        def.reportName        || '',
    title:             def.reportDefnTitle   || def.reportName || '',
    description:       def.reportDescription || '',
    defaultFormat:     def.defaultOutputFormat || 'pdf',
    defaultTemplateId: def.defaultTemplateId   || '',
    templateIds, availableFormats,
  };
}

module.exports = {
  getModules, getReportsByModule, getFolderContents,
  getReportParameters, runReport, getReportDefinition,
  FORMAT_MIME, FORMAT_EXT, SUPPORTED_FORMATS: Object.keys(FORMAT_MIME),
};