const { body } = require("express-validator");
const validatorr = require("../middlewares/ValidatorMiddle");

const registerValidationRules = [
  body("first_name").notEmpty().withMessage("First name is required"),
  body("last_name").notEmpty().withMessage("Last name is required"),
  body("username").notEmpty().withMessage("Username is required"),
  
  // Updated email validation to explicitly check for @ symbol
  body("email")
    .isEmail().withMessage("Invalid email format")
    .custom(value => {
      if (!value.includes('@')) {
        throw new Error('Email must contain @ symbol');
      }
      return true;
    }),
  
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  
  // Updated phone number validation
  body("phone_number")
    .notEmpty().withMessage("Phone number is required")
    .matches(/^(01)[0-2,5]{1}[0-9]{8}$/).withMessage("Phone number must be a valid Egyptian number (11 digits starting with 01)"),
  
  // Updated national ID validation to require exactly 14 digits
  body("national_id")
    .notEmpty().withMessage("National ID is required")
    .isLength({ min: 14, max: 14 }).withMessage("National ID must be exactly 14 digits")
    .matches(/^[0-9]{14}$/).withMessage("National ID must contain only digits"),
  
  validatorr,
];

const loginValidationRules = [
  // Updated email validation to explicitly check for @ symbol
  body("email")
    .isEmail().withMessage("Invalid email format")
    .custom(value => {
      if (!value.includes('@')) {
        throw new Error('Email must contain @ symbol');
      }
      return true;
    }),
    
  body("password").notEmpty().withMessage("Password is required"),
  validatorr,
];

module.exports = { registerValidationRules, loginValidationRules };