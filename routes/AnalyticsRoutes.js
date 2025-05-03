const express = require('express');
const router = express.Router();
const protect = require("../middlewares/AuthMiddle");
const authorize = require("../middlewares/AuthorizeMiddle");

const authMiddleware = protect;
const adminMiddleware = authorize('admin');
const sellerMiddleware = authorize('seller', 'admin');
const analyticsService = require('../services/analyticsService');

const {
  getAdminDashboard,
  getSellerDashboard,
  getItemAnalytics,
  getUserGrowthAnalytics,
  getAuctionAnalytics,
  getFinancialReport,
  getCommissionAnalytics,
  getTopSellers,
  getCategoryAnalytics,
  getPlatformGrowth,
  getConversionMetrics
} = require('../controllers/AnalyticsController');

// ======================
// ADMIN ANALYTICS ROUTES
// ======================

// Main admin dashboard with comprehensive stats
router.get('/admin/dashboard', authMiddleware, adminMiddleware, getAdminDashboard);//dn

// User growth analytics
router.get('/admin/users/growth', authMiddleware, adminMiddleware, getUserGrowthAnalytics);
// Auction performance analytics
// Auction analytics route
router.get('/admin/auctions/analytics', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, groupBy } = req.query;
    const analytics = await analyticsService.getAuctionAnalytics(startDate, endDate, groupBy);
    
    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
// Financial reporting with commission breakdown
router.get('/admin/financial-report', authMiddleware, adminMiddleware, getFinancialReport);//dn

// Detailed commission analytics
router.get('/admin/commissions', authMiddleware, adminMiddleware, getCommissionAnalytics);//dn

// Top sellers ranking
router.get('/admin/top-sellers', authMiddleware, adminMiddleware, getTopSellers);//dn

// Category performance analytics
router.get('/admin/categories', authMiddleware, adminMiddleware, getCategoryAnalytics);//dn

// Platform growth metrics
router.get('/admin/platform-growth', authMiddleware, adminMiddleware, getPlatformGrowth);//dn

// Conversion metrics
router.get('/admin/conversions', authMiddleware, adminMiddleware, getConversionMetrics);

// =======================
// SELLER ANALYTICS ROUTES
// =======================

// Seller dashboard with performance metrics
router.get('/seller/dashboard', authMiddleware, sellerMiddleware, getSellerDashboard);//dn

// =====================
// ITEM ANALYTICS ROUTES
// =====================

// Item performance analytics - accessible by both admins and the item's seller
router.get('/items/:itemId/analytics', authMiddleware, getItemAnalytics);//dn

module.exports = router;