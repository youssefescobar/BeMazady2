const express = require("express");
const router = express.Router();
const {
  registerValidationRules,
  loginValidationRules,
} = require("../utils/Validators/AuthValid");
const { register, login } = require("../controllers/AuthController");

// Register route
router.post("/register", registerValidationRules, register);

// Login route
router.post("/login", loginValidationRules, login);

module.exports = router;
