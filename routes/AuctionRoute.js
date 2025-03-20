const express = require("express");
const router = express.Router();
const protect = require("../middlewares/AuthMiddle"); // Ensure correct path
const authorize = require("../middlewares/AuthorizeMiddle"); // Import authorize middleware

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

// Public: Anyone can view auctions
router.get("/", getAllAuctions);
router.get("/:id", GetAuctionValidator, getAuction);

// Protected: Only logged-in users can create auctions
router.post("/", protect, CreateAuctionValidator, createAuction);

// Protected: Only logged-in users can place bids
router.post("/:id/bid", protect, PlaceBidValidator, placeBid);

// Protected: Only auction owners or admins can update an auction
router.put(
  "/:id",
  protect,
  authorize("admin", "seller"),
  UpdateAuctionValidator,
  updateAuction
);

// Protected: Only admins can end an auction
router.post(
  "/:id/end",
  protect,
  authorize("admin"),
  EndAuctionValidator,
  endAuction
);

module.exports = router;
