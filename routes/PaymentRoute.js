const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/PaymentController"); // Verify this path

const protect = require("../middlewares/AuthMiddle");
// Public callback routes
router.get("/success", paymentController.paymentSuccess); // This is line 11 causing the error
router.get("/failure", paymentController.paymentFailure);

// Webhook needs raw body
router.post("/webhook", express.raw({type: 'application/json'}), paymentController.stripeWebhook);


// Protected routes
router.use(protect);
router.post("/initialize", paymentController.initializePayment);
router.post("/cod", paymentController.createCodOrder);
router.get("/methods", paymentController.getPaymentMethods);
router.get("/transactions", paymentController.getUserTransactions);
router.get("/transactions/:id", paymentController.getTransaction);

module.exports = router;