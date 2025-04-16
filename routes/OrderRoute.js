const express = require("express")
const router = express.Router()
const orderController = require("../controllers/OrderController")
const protect = require("../middlewares/AuthMiddle")
const authorize = require("../middlewares/AuthorizeMiddle") // Use your existing middleware

// Protected routes
router.use(protect)

router.get("/", orderController.getUserOrders)
router.get("/:id", orderController.getOrder)
router.patch("/:id/cancel", orderController.cancelOrder)

// Admin routes
router.use(authorize("admin")) // Use your existing middleware
router.get("/admin/all", orderController.getAllOrders)
router.patch("/:id/status", orderController.updateOrderStatus)

module.exports = router
