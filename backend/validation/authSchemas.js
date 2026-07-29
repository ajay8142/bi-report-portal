// backend/validation/authSchemas.js
const Joi = require('joi');
const { passwordComplexity } = require('./common');

module.exports = {
  login: {
    body: Joi.object({
      email: Joi.string().email({ tlds: { allow: false } }).required(),
      password: Joi.string().required(),
    }),
  },

  changePassword: {
    body: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: passwordComplexity,
    }),
  },
};
