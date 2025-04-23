const express = require("express");
const router = express.Router();
const protect = require("../middlewares/AuthMiddle"); // Import protect middleware
const authorize = require("../middlewares/AuthorizeMiddle"); // Import authorize middleware
const uploadMiddleware = require("../middlewares/UploadMiddle"); // For image uploads

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
} = require("../controllers/ReverseAuctionController");

// You might want to add validators later
// const { ReverseAuctionValidator } = require("../utils/Validators/ReverseAuctionValid");

// 🟢 Public: Anyone can view reverse auctions
router.get("/", getAllReverseAuctions);
router.get("/:id", getReverseAuction);

// 🟢 Protected: Only logged-in users can view their auctions and bids
router.get("/my/auctions", protect, getMyReverseAuctions);
router.get("/my/bids", protect, getMyBids);

// 🟢 Protected: Only logged-in buyers can create reverse auctions (With Image Upload)
router.post(
  "/",
  protect,
  authorize("buyer", "admin"),
  uploadMiddleware,
  // ReverseAuctionValidator, // You might add this later
  createReverseAuction
);

// 🟢 Protected: Only auction owners can update their reverse auctions
router.put(
  "/:id",
  protect,
  // authorize("buyer", "admin"), // Uncomment if needed
  uploadMiddleware,
  // UpdateReverseAuctionValidator, // You might add this later
  updateReverseAuction
);

// 🟢 Protected: Only auction owners can delete their reverse auctions
router.delete("/:id", protect, deleteReverseAuction);

// 🟢 Protected: Only sellers can place bids on reverse auctions
router.post(
  "/:id/bid",
  protect,
  authorize("seller", "admin"),
  // PlaceBidValidator, // You might add this later
  placeBid
);

// 🟢 Protected: Only auction owners can accept bids
router.post("/:id/accept-bid/:bidId", protect, acceptBid);

// 🟢 Protected: Only auction owners can cancel their reverse auctions
router.patch("/:id/cancel", protect, cancelReverseAuction);

module.exports = router;