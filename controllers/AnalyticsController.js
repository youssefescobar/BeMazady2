const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const analyticsService = require('../services/analyticsService');
// Get comprehensive admin dashboard statistics
const getAdminDashboard = asyncHandler(async (req, res) => {
  const { period } = req.query;
  
  const stats = await analyticsService.getAdminDashboardStats(period);
  
  res.status(200).json({
    success: true,
    data: stats
  });
});

// Get seller dashboard statistics
const getSellerDashboard = asyncHandler(async (req, res) => {
  const { period } = req.query;
  const sellerId = req.user.id;
  
  const stats = await analyticsService.getSellerStats(sellerId, period);
  
  res.status(200).json({
    success: true,
    data: stats
  });
});

// Get item analytics
const getItemAnalytics = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  
  const stats = await analyticsService.getItemAnalytics(itemId);
  
  res.status(200).json({
    success: true,
    data: stats
  });
});

// Get user growth analytics (admin only)
const getUserGrowthAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate, groupBy } = req.query;
  
  const analytics = await analyticsService.getUserGrowthAnalytics(
    startDate, 
    endDate, 
    groupBy
  );
  
  res.status(200).json({
    success: true,
    data: analytics
  });
});

// Get auction analytics (admin only)
const getAuctionAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate, groupBy } = req.query;
  
  const analytics = await analyticsService.getAuctionAnalytics(
    startDate, 
    endDate, 
    groupBy
  );
  
  res.status(200).json({
    success: true,
    data: analytics
  });
});

// Get financial report with commission breakdown (admin only)
const getFinancialReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, groupBy = 'month' } = req.query;
  
  const report = await analyticsService.getFinancialReport(startDate, endDate, groupBy);
  
  res.status(200).json({
    success: true,
    data: report
  });
});

// Get commission analytics (admin only)
const getCommissionAnalytics = asyncHandler(async (req, res) => {
  const { period, detailed } = req.query;
  
  const stats = await analyticsService.getCommissionAnalytics(period, detailed);
  
  res.status(200).json({
    success: true,
    data: stats
  });
});

// Get top sellers analytics (admin only)
const getTopSellers = asyncHandler(async (req, res) => {
  const { limit, period } = req.query;
  
  const sellers = await analyticsService.getTopSellers(limit, period);
  
  res.status(200).json({
    success: true,
    data: sellers
  });
});

// Get category performance analytics (admin only)
const getCategoryAnalytics = asyncHandler(async (req, res) => {
  const { period } = req.query;
  
  const stats = await analyticsService.getCategoryAnalytics(period);
  
  res.status(200).json({
    success: true,
    data: stats
  });
});

// Get platform growth metrics (admin only)
const getPlatformGrowth = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const growth = await analyticsService.getPlatformGrowth(startDate, endDate);
  
  res.status(200).json({
    success: true,
    data: growth
  });
});

// Get conversion metrics (admin only)
const getConversionMetrics = asyncHandler(async (req, res) => {
  const { period } = req.query;
  
  const metrics = await analyticsService.getConversionMetrics(period);
  
  res.status(200).json({
    success: true,
    data: metrics
  });
});

module.exports = {
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
};