// routes/AnalyticsRoutes.js
const express = require('express');
const router = express.Router();
const protect = require("../middlewares/AuthMiddle");
const authorize = require("../middlewares/AuthorizeMiddle");

const authMiddleware = protect;
const adminMiddleware = authorize('admin');
const sellerMiddleware = authorize('seller');
const {
  getAdminDashboard,
  getSellerDashboard,
  getItemAnalytics,
  getUserGrowthAnalytics,
  getAuctionAnalytics
} = require('../controllers/AnalyticsController');

// Admin routes
router.get('/admin/dashboard', authMiddleware, adminMiddleware, getAdminDashboard);
router.get('/admin/users', authMiddleware, adminMiddleware, getUserGrowthAnalytics);
router.get('/admin/auctions', authMiddleware, adminMiddleware, getAuctionAnalytics);

// Seller routes
router.get('/seller/dashboard', authMiddleware, sellerMiddleware, getSellerDashboard);

// Item analytics - accessible by both admins and the item's seller
router.get('/item/:itemId', authMiddleware, getItemAnalytics);

module.exports = router;