// backend/middleware/validate.js
//
// Generic Joi request validator. Pass schemas for whichever of body/params/
// query a route expects; parts with no schema are left untouched. On success,
// req.body/req.params/req.query are replaced with the validated value — Joi's
// `convert` coerces types (e.g. ":id" route params from string to number) and
// `stripUnknown` drops fields the client sent but the route doesn't expect —
// so controllers can trust shape/types instead of re-checking them ad hoc.
//
// Usage:
//   router.post('/clients', validate({ body: adminSchemas.createClient }), ctrl.createClient);

function validate({ body, params, query } = {}) {
  const parts = { params, query, body }; // validate params/query before body — cheaper, fails fast on bad routes
  return (req, res, next) => {
    for (const [key, schema] of Object.entries(parts)) {
      if (!schema) continue;
      const { error, value } = schema.validate(req[key], {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.details.map((d) => d.message).join('; '),
        });
      }
      req[key] = value;
    }
    next();
  };
}

module.exports = validate;
