const express = require("express");
const router = express.Router();
const  protect = require("../middlewares/AuthMiddle");
const {
  createCheckoutSession,
  handleWebhook,
} = require("../controllers/PaymentController");

// Create checkout session
router.post("/create-checkout-session", protect, createCheckoutSession);

// Stripe webhook
router.post("/webhook", handleWebhook);

module.exports = router;