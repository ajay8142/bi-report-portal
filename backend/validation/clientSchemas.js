// backend/validation/clientSchemas.js
const Joi = require('joi');
const { reportParamItem } = require('./common');

module.exports = {
  getReports: {
    query: Joi.object({
      path: Joi.string().trim().min(1).invalid('undefined').required(),
    }),
  },

  getParameters: {
    query: Joi.object({
      path: Joi.string().trim().min(1),
      reportPath: Joi.string().trim().min(1),
    }).or('path', 'reportPath'),
  },

  refreshParameters: {
    body: Joi.object({
      path: Joi.string().trim().min(1).required(),
      currentParams: Joi.array().items(reportParamItem).default([]),
    }),
  },

  runReport: {
    body: Joi.object({
      reportPath: Joi.string().trim().min(1).required(),
      // Allowed values are engine-dependent (bip.SUPPORTED_FORMATS) — checked
      // against the live list in clientController.runReport, not hardcoded here.
      format: Joi.string().trim().lowercase().min(1).required(),
      params: Joi.array().items(reportParamItem).default([]),
      templateId: Joi.string().allow('').default(''),
      locale: Joi.string().trim().lowercase().optional(),
      timezone: Joi.string().trim().optional(),
      action: Joi.string().valid('preview', 'download').optional(),
      // Best-effort client-reported IP for the audit log — resolveClientIp()
      // in the controller falls back to the server-observed address if this
      // isn't a plausible IP, so it's deliberately not validated as strictly
      // an IP here.
      clientIp: Joi.string().trim().allow('').optional(),
    }),
  },
};
