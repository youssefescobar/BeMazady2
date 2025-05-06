const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/AnalyticsController");
const protect = require("../middlewares/AuthMiddle");
const authorize = require("../middlewares/AuthorizeMiddle");

// ========= ADMIN =========
router.get(
  "/admin/overview",
  protect,
  authorize("admin"),
  analyticsController.getAdminOverview
);

router.get(
  "/admin/users",
  protect,
  authorize("admin"),
  analyticsController.getUserCount
);

router.get(
  "/admin/items",
  protect,
  authorize("admin"),
  analyticsController.getItemCount
);

router.get(
  "/admin/auctions",
  protect,
  authorize("admin"),
  analyticsController.getAuctionCount
);

router.get(
  "/admin/top-sellers",
  protect,
  authorize("admin"),
  analyticsController.getTopSellers
);

// ========= SELLER =========
router.get(
  "/seller/overview",
  protect,
  authorize("seller", "admin"),
  analyticsController.getSellerOverview
);

router.get(
  "/seller/my-items",
  protect,
  authorize("seller", "admin"),
  analyticsController.getMyItems
);

router.get(
  "/seller/my-auctions",
  protect,
  authorize("seller", "admin"),
  analyticsController.getMyAuctions
);

module.exports = router;
