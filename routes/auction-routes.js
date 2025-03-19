const express = require("express");
const router = express.Router();
const auctionController = require("../controllers/auction-controller");
const authMiddleware = require("../middlewares/auth-middleware");
const {
  auctionValidationRules,
  bidValidationRules,
} = require("../utils/auction-validator");

// PUBLIC ROUTES
// Get all auctions (with filters, sorting, pagination)
router.get("/", auctionController.getAllAuctions);

// Get a single auction by ID
router.get("/:id", auctionController.getAuctionById);

// PROTECTED ROUTES (require authentication)
// Create a new auction
router.post(
  "/",
  authMiddleware,
  auctionValidationRules.create,
  auctionController.createAuction
);

// Update an auction
router.put(
  "/:id",
  authMiddleware,
  auctionValidationRules.update,
  auctionController.updateAuction
);

// Delete an auction
router.delete("/:id", authMiddleware, auctionController.deleteAuction);

// Place a bid
router.post(
  "/:id/bid",
  authMiddleware,
  bidValidationRules,
  auctionController.placeBid
);

// Toggle watch status
router.post("/:id/watch", authMiddleware, auctionController.toggleWatchAuction);

// Get user's watched auctions
router.get(
  "/user/watching",
  authMiddleware,
  auctionController.getWatchedAuctions
);

// Get auction dashboard stats
router.get(
  "/user/dashboard",
  authMiddleware,
  auctionController.getDashboardStats
);

module.exports = router;
