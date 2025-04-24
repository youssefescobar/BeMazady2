const express = require("express")
const router = express.Router()
const paymentController = require("../controllers/PaymentController")
const protect = require("../middlewares/AuthMiddle")
// Public routes
router.get("/callback", (req, res) => {
    const { order, success, transaction_id } = req.query;
  
    return res.status(200).json({
      status: "success",
      message: "Payment callback received",
      data: { order, success, transaction_id }
    });
  });
// Protected routes
router.use(protect)

router.post("/initialize", paymentController.initializePayment)
router.post("/cod", paymentController.createCodOrder)
router.get("/methods", paymentController.getPaymentMethods)
router.get("/transactions", paymentController.getUserTransactions)
router.get("/transactions/:id", paymentController.getTransaction)

module.exports = router
