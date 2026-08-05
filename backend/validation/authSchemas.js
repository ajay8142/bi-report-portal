// backend/validation/authSchemas.js
const Joi = require('joi');
const { passwordComplexity } = require('./common');

module.exports = {
  login: {
    body: Joi.object({
      user_name: Joi.string().trim().min(1).required(),
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
