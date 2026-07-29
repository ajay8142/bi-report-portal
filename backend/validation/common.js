// backend/validation/common.js
// Shared fragments so every route validating an :id-style param or a
// password uses the exact same rule instead of subtly-different copies.
const Joi = require('joi');

// Route params (:id, :clientId, :userId) are always numeric primary keys here —
// catches a non-numeric id with a 400 instead of it reaching `Number(id)` as
// NaN and silently matching zero rows in a WHERE clause.
const idParam = Joi.number().integer().positive().required();

const email = Joi.string().email({ tlds: { allow: false } }).required();

// Same complexity rule authController/adminController already enforced ad hoc —
// centralized so it can't drift between the two call sites.
const passwordComplexity = Joi.string()
  .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/)
  .required()
  .messages({ 'string.pattern.base': 'Password: min 8 chars, 1 uppercase, 1 number, 1 special char' });

// BIP report parameters (runReport.params / refreshParameters.currentParams) —
// shape is dynamic (whatever BIP's parameter LOV returns, echoed back with the
// user's selected values), so this only pins down the fields the backend
// actually reads and leaves the rest passable via `.unknown(true)`.
const reportParamItem = Joi.object({
  name: Joi.string().allow('', null),
  dataType: Joi.string().allow('', null),
  UIType: Joi.string().allow('', null),
  multiValuesAllowed: Joi.any(),
  dateFormatString: Joi.string().allow('', null),
  useNullForAll: Joi.any(),
  values: Joi.array().items(Joi.any()).default([]),
  label: Joi.string().allow('', null),
  lovLabels: Joi.array().items(Joi.any()),
  defaultValue: Joi.any(),
}).unknown(true);

module.exports = { idParam, email, passwordComplexity, reportParamItem };
