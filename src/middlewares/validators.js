const Joi = require("joi");
const createError = require("../utils/createError");
//Joi object
//Auth path
const registerSchema = Joi.object({
  name: Joi.string().required().messages({
    "string.empty": "Name is required.",
    "string.base": "Name datatype must be a string.",
  }),
  email: Joi.string().email({ tlds: false }).required().messages({
    "string.empty": "Email is required.",
    "string.base": "Email datatype must be a string.",
    "string.email": "Email must be valid.",
  }),
  password: Joi.string() //password length must be at least 6 characters long include just only number and letter
    .required()
    .min(6)
    .max(20)
    .pattern(/^[a-zA-Z0-9!@#$%^&*()_+[\]{};':"\\|,.<>/?`~=-]*$/)
    .messages({
      "string.base": "Password must be a string.",
      "string.empty": "Password is required.",
      "string.min": "Password should have length between 6 to 20 characters.",
      "string.max": "Password should have length between 6 to 20 characters.",
      "string.pattern.base": "Password contains invalid characters.",
    }),
  confirmPassword: Joi.string().required().valid(Joi.ref("password")).messages({
    "any.only": "password does not match.",
    "string.empty": "Confirm password is required.",
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().required().messages({
    "string.empty": "email is required.",
    "string.base": "email invalid.",
    "string.email": "Email must be valid.",
  }),
  password: Joi.string().required().messages({
    "string.empty": "Password is required.",
    "string.base": "Password invalid.",
  }),
});

const validateSchema = (schema) => (req, res, next) => {
  const { value, error } = schema.validate(req.body);
  if (error) {
    return createError(400, error.details[0].message);
  }
  req.input = value;
  next();
};

module.exports.registerValidator = validateSchema(registerSchema);
module.exports.loginValidator = validateSchema(loginSchema);
