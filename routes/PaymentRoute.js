const express = require("express")
const router = express.Router()
const paymentController = require("../controllers/PaymentController")
const protect = require("../middlewares/AuthMiddle")
// Public routes
router.get("/callback", paymentController.paymentCallback)

// Protected routes
router.use(protect)

router.post("/initialize", paymentController.initializePayment)
router.post("/cod", paymentController.createCodOrder)
router.get("/methods", paymentController.getPaymentMethods)
router.get("/transactions", paymentController.getUserTransactions)
router.get("/transactions/:id", paymentController.getTransaction)

module.exports = router
