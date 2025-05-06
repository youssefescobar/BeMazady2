const express = require("express");
const router = express.Router();

// Import controllers
const {
  createReverseAuction,
  getAllReverseAuctions,
  getReverseAuction,
  updateReverseAuction,
  deleteReverseAuction,
  placeBid,
  acceptBid,
  getMyReverseAuctions,
  getMyBids,
  cancelReverseAuction,
  prepareCheckout,
  processPayment,
  paymentCallback
} = require("../controllers/ReverseAuctionController");

// Import middlewares - assuming direct function exports
const AuthMiddle = require("../middlewares/AuthMiddle.js");
const restrictTo = require("../middlewares/AuthorizeMiddle.js");
const UploadMiddle = require("../middlewares/UploadMiddle.js");

// Public routes
router.get("/", getAllReverseAuctions);
router.get("/:id", getReverseAuction);
router.get("/payment/callback", paymentCallback);

// Assuming AuthMiddle is the protect function itself or contains protect function
const protect = typeof AuthMiddle === 'function' ? AuthMiddle : AuthMiddle.protect;

// Protected routes - apply protect middleware directly
// Buyer routes
router.post("/", protect, restrictTo("buyer"), createReverseAuction);
router.put("/:id", protect, restrictTo("buyer"), updateReverseAuction);
router.delete("/:id", protect, restrictTo("buyer"), deleteReverseAuction);
router.post("/:id/accept-bid/:bidId", protect, restrictTo("buyer"), acceptBid);
router.get("/:id/checkout/:bidId", protect, restrictTo("buyer"), prepareCheckout);
router.post("/payment", protect, restrictTo("buyer"), processPayment);
router.patch("/:id/cancel", protect, restrictTo("buyer"), cancelReverseAuction);
router.get("/my-auctions", protect, restrictTo("buyer"), getMyReverseAuctions);

// Seller routes
router.post("/:id/bid", protect, restrictTo("seller"), placeBid);
router.get("/my-bids", protect, restrictTo("seller"), getMyBids);

module.exports = router;