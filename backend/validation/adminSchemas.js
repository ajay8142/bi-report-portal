// backend/validation/adminSchemas.js
const Joi = require('joi');
const { idParam, email, passwordComplexity } = require('./common');

// Must match the ENGINES keys in config/reportEngine.js.
const ENGINE_NAMES = ['bip', 'reportingtool'];

// Must match the codes in frontend/src/constants/languages.js and
// clientController.js's LOCALE_MAP.
const REPORT_LANGUAGES = ['EN', 'FR', 'AR', 'RU', 'VI'];
const reportLanguage = Joi.string().trim().uppercase().valid(...REPORT_LANGUAGES);

const assignmentFields = {
  clientId: Joi.number().integer().positive().required(),
  // Empty strings are the normal case here (see toggleAssignment/setAssignmentFlag
  // in adminController.js) — these are display metadata, not identifiers.
  moduleName: Joi.string().trim().allow('').default(''),
  modulePath: Joi.string().trim().allow('').default(''),
  reportName: Joi.string().trim().allow('').default(''),
  reportPath: Joi.string().trim().min(1).required(),
};

module.exports = {
  setReportEngine: {
    body: Joi.object({
      engine: Joi.string().valid(...ENGINE_NAMES).required(),
    }),
  },

  getModules: {
    query: Joi.object({
      path: Joi.string().trim().min(1).optional(),
    }),
  },

  getReports: {
    query: Joi.object({
      // Guards the same "path=undefined" frontend-bug symptom the original
      // handler checked for explicitly.
      path: Joi.string().trim().min(1).invalid('undefined').required(),
    }),
  },

  createClient: {
    body: Joi.object({
      name: Joi.string().trim().min(1).required(),
      user_name: Joi.string().trim().min(1).required(),
      email,
      password: passwordComplexity,
      report_language: reportLanguage.default('EN'),
    }),
  },

  updateClient: {
    params: Joi.object({ id: idParam }),
    body: Joi.object({
      name: Joi.string().trim().min(1),
      user_name: Joi.string().trim().min(1),
      is_active: Joi.number().valid(0, 1), // frontend sends 0/1, not true/false — see Clients.jsx
      report_language: reportLanguage,
    }).min(1), // at least one field to update
  },

  // :id (a client's own USER_ID) — used by updateClient/deleteClient.
  idParams: {
    params: Joi.object({ id: idParam }),
  },

  // :clientId — used by getAssignments/getClientHistory/getUserRoles/disableAllAssignments.
  clientIdParams: {
    params: Joi.object({ clientId: idParam }),
  },

  toggleAssignment: {
    body: Joi.object({
      ...assignmentFields,
      isEnabled: Joi.boolean().default(false),
      userRole: Joi.string().trim().allow('').when('isEnabled', {
        is: true,
        then: Joi.string().trim().min(1).required(),
        otherwise: Joi.string().trim().allow('').optional(),
      }),
    }),
  },

  setAssignmentFlag: {
    body: Joi.object({
      ...assignmentFields,
      flag: Joi.string().valid('PRINT', 'GENERATE').required(),
      value: Joi.boolean().required(),
    }),
  },

  accessMutation: {
    body: Joi.object({
      userId: Joi.number().integer().positive().required(),
      code: Joi.string().trim().min(1).required(),
    }),
  },

  accessDeletion: {
    params: Joi.object({
      userId: idParam,
      // Still URL-encoded here (decodeURIComponent happens in the controller) —
      // just needs to be a non-empty string at this layer.
      code: Joi.string().min(1).required(),
    }),
  },

  searchReports: {
    query: Joi.object({
      q: Joi.string().trim().min(1).required(),
      top_k: Joi.number().integer().min(1).max(50).optional(),
    }),
  },

  // :id — a Chroma document id from the /report-search results, used to fetch
  // one report's full metadata.
  reportSearchIdParams: {
    params: Joi.object({ id: Joi.string().trim().min(1).required() }),
  },
};
