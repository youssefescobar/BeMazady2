const express = require("express");
const router = express.Router();
const protect = require("../middlewares/AuthMiddle"); // Ensure correct path
const authorize = require("../middlewares/AuthorizeMiddle"); // Import authorize middleware
const uploadMiddleware = require("../middlewares/UploadMiddle"); // Import upload middleware
const asyncHandler = require("express-async-handler");
const {
  createAuction,
  placeBid,
  getAuction,
  getAllAuctions,
  endAuction,
  updateAuction,
  deleteAuction,
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
router.post(
  "/",
  protect,
  uploadMiddleware,
  CreateAuctionValidator,
  createAuction
);

// 🟢 Protected: Only logged-in users can place bids
router.post("/:id/bid", protect, PlaceBidValidator, placeBid);

// 🟢 Protected: Only auction owners or admins can update an auction (With Image Upload)
router.put(
  "/:id",
  protect,
  authorize("admin", "seller"),
  uploadMiddleware,
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
router.delete("/:id", protect, deleteAuction);

router.post('/process-expired', asyncHandler(async (req, res) => {
  const { endExpiredAuctions } = require('../services/scheduledTasks');
  await endExpiredAuctions();
  res.status(200).json({ message: 'Expired auctions processed successfully' });
}));
module.exports = router;
