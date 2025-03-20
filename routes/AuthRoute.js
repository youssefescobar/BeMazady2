const express = require("express");
const router = express.Router();
const {
  registerValidationRules,
  loginValidationRules,
} = require("../utils/Validators/AuthValid");
const { Signup, login } = require("../controllers/AuthController");

// Register route
router.post("/register", registerValidationRules, Signup);

// Login route
router.post("/login", loginValidationRules, login);

module.exports = router;
