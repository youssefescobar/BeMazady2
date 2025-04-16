const { check } = require("express-validator")
const validatorMiddleware = require("../middlewares/validatorMiddleware")

exports.validatePaymentInit = [
  check("amount")
    .notEmpty()
    .withMessage("Amount is required")
    .isNumeric()
    .withMessage("Amount must be a number")
    .isFloat({ min: 1 })
    .withMessage("Amount must be greater than 0"),

  check("items").notEmpty().withMessage("Items are required").isArray().withMessage("Items must be an array"),

  check("paymentMethod")
    .notEmpty()
    .withMessage("Payment method is required")
    .isIn(["card", "vodafone-cash", "orange-money", "etisalat-cash", "we-pay", "fawry", "meeza", "cod"])
    .withMessage("Invalid payment method"),

  check("billingDetails")
    .notEmpty()
    .withMessage("Billing details are required")
    .isObject()
    .withMessage("Billing details must be an object"),

  check("billingDetails.firstName").notEmpty().withMessage("First name is required"),

  check("billingDetails.lastName").notEmpty().withMessage("Last name is required"),

  check("billingDetails.email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format"),

  check("billingDetails.phoneNumber").notEmpty().withMessage("Phone number is required"),

  check("billingDetails.street").notEmpty().withMessage("Street is required"),

  check("billingDetails.city").notEmpty().withMessage("City is required"),

  check("billingDetails.country").notEmpty().withMessage("Country is required"),

  validatorMiddleware,
]
