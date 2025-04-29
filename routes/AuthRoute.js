const express = require("express");
const router = express.Router();
const protect = require("../middlewares/AuthMiddle"); 
const authorize = require("../middlewares/AuthorizeMiddle"); 
const {
  registerValidationRules,
  loginValidationRules,
} = require("../utils/Validators/AuthValid");
const {
  Signup,
  login,
  registerBuyer,
  registerSeller,
  Forgotpassword,
  Verifycode,
  Resetpassword,
} = require("../controllers/AuthController");

// Register route
router.post("/register", registerValidationRules, Signup);

//maybe delete bardo
router.post("/register/buyer", registerValidationRules, registerBuyer);
router.post("/register/seller",registerValidationRules, registerSeller);
// Login route
router.post("/login", loginValidationRules, login);

// idk maybe delete 
router.get("/buyer", protect, authorize("buyer"), (req, res) => {
  res.json({
    success: true,
    message: "Buyer dashboard accessed successfully",
    data: {
      user: req.user,
    },
  });
});

router.get("/seller", protect, authorize("seller"), (req, res) => {
  res.json({
    success: true,
    message: "Seller dashboard accessed successfully",
    data: {
      user: req.user,
    },
  });
});

// Forgot password
router.post("/forgotpassword", Forgotpassword);

// verify code
router.post("/verify", Verifycode);

router.put("/resetpassword", Resetpassword);

module.exports = router;
