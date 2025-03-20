const { body } = require("express-validator");
const User = require("../../models/User");
const validatorr = require("../../middlewares/ValidatorMiddle");
const registerValidationRules = [
  body("first_name").notEmpty().withMessage("First name is required"),
  body("last_name").notEmpty().withMessage("Last name is required"),

  body("username")
    .notEmpty()
    .withMessage("Username is required")
    .custom(async (val) => {
      const user = await User.findOne({ username: val });
      if (user) {
        return Promise.reject("Username already in use");
      }
    }),

  body("email")
    .isEmail()
    .withMessage("Invalid email format")
    .custom((value) => {
      if (!value.includes("@")) {
        throw new Error("Email must contain @ symbol");
      }
      return true;
    })
    .custom(async (val) => {
      const user = await User.findOne({ email: val });
      if (user) {
        return Promise.reject("Email already in use");
      }
    }),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),

  body("phone_number")
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^(01)[0-2,5]{1}[0-9]{8}$/)
    .withMessage(
      "Phone number must be a valid Egyptian number (11 digits starting with 01)"
    )
    .custom(async (val) => {
      const user = await User.findOne({ phone_number: val });
      if (user) {
        return Promise.reject("Phone number is already in use");
      }
    }),

  body("national_id")
    .notEmpty()
    .withMessage("National ID is required")
    .isLength({ min: 14, max: 14 })
    .withMessage("National ID must be exactly 14 digits")
    .matches(/^[0-9]{14}$/)
    .withMessage("National ID must contain only digits")
    .custom(async (val) => {
      const user = await User.findOne({ national_id: val });
      if (user) {
        return Promise.reject("National ID already in use");
      }
    }),

  validatorr,
];

const loginValidationRules = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .custom((value) => {
      if (!value.includes("@")) {
        throw new Error("Email must contain @ symbol");
      }
      return true;
    }),

  body("password").notEmpty().withMessage("Password is required"),

  validatorr,
];

module.exports = { registerValidationRules, loginValidationRules };
