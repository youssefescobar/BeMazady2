const express = require("express");
const router = express.Router();
const {
  createOrderFromCart,
  createAuctionOrder,
  getOrderById,
  getMyOrders,
  updateOrderToPaid,
  webhook,
} = require("../controllers/OrderController");
const protect = require("../middlewares/AuthMiddle");
const authorize = require("../middlewares/AuthorizeMiddle");

// Public webhook route (no auth needed)
router.post("/webhook", webhook);

// Protected routes
router.post("/checkout", protect, createOrderFromCart);
router.post("/auction/:auctionId", protect, createAuctionOrder);
router.get("/:id", protect, getOrderById);
router.get("/myorders", protect, getMyOrders);
router.put("/:id/pay", protect, updateOrderToPaid);

module.exports = router;