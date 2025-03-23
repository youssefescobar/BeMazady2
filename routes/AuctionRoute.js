const express = require("express");
const router = express.Router();
const protect = require("../middlewares/AuthMiddle"); // Ensure correct path
const authorize = require("../middlewares/AuthorizeMiddle"); // Import authorize middleware
const upload = require("../middlewares/UploadMiddle"); // Import upload middleware

const {
  createAuction,
  placeBid,
  getAuction,
  getAllAuctions,
  endAuction,
  updateAuction,
} = require("../controllers/AuctionController");

const {
  CreateAuctionValidator,
  PlaceBidValidator,
  GetAuctionValidator,
  UpdateAuctionValidator,
  EndAuctionValidator,
} = require("../utils/Validators/AuctionValid");

// 🟢 Public: Anyone can view auctions
router.get("/", getAllAuctions);
router.get("/:id", GetAuctionValidator, getAuction);

// 🟢 Protected: Only logged-in users can create auctions (With Image Upload)
router.post("/", protect, upload, CreateAuctionValidator, createAuction);

// 🟢 Protected: Only logged-in users can place bids
router.post("/:id/bid", protect, PlaceBidValidator, placeBid);

// 🟢 Protected: Only auction owners or admins can update an auction (With Image Upload)
router.put(
  "/:id",
  protect,
  authorize("admin", "seller"), // Ensure correct roles
  upload, // Allow updating images
  UpdateAuctionValidator,
  updateAuction
);

// 🟢 Protected: Only admins can end an auction
router.post(
  "/:id/end",
  protect,
  authorize("admin"), // Only admins can end
  EndAuctionValidator,
  endAuction
);

module.exports = router;
