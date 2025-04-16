// controllers/AnalyticsController.js
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const analyticsService = require('../services/analyticsService');

// Get admin dashboard statistics
const getAdminDashboard = asyncHandler(async (req, res) => {
  const { period } = req.query;
  
  const stats = await analyticsService.getAdminDashboardStats(period);
  
  res.status(200).json({
    success: true,
    data: stats
  });
});

// Get seller statistics
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
const getItemAnalytics = asyncHandler(async (req, res, next) => {
  const { itemId } = req.params;
  
  const stats = await analyticsService.getItemAnalytics(itemId);
  
  res.status(200).json({
    success: true,
    data: stats
  });
});

// Get user growth analytics (admin only)
const getUserGrowthAnalytics = asyncHandler(async (req, res) => {
  const User = require('../models/User');
  const { startDate, endDate } = req.query;
  
  // Parse dates or use defaults
  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 6));
  const end = endDate ? new Date(endDate) : new Date();
  
  // Get user signups by month
  const userGrowth = await User.aggregate([
    { 
      $match: { 
        createdAt: { $gte: start, $lte: end }
      } 
    },
    {
      $group: {
        _id: { 
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { 
      $sort: { 
        '_id.year': 1, 
        '_id.month': 1 
      } 
    },
    {
      $project: {
        _id: 0,
        date: {
          $concat: [
            { $toString: '$_id.year' },
            '-',
            {
              $cond: {
                if: { $lt: ['$_id.month', 10] },
                then: { $concat: ['0', { $toString: '$_id.month' }] },
                else: { $toString: '$_id.month' }
              }
            }
          ]
        },
        count: 1
      }
    }
  ]);
  
  // Get user count by role
  const usersByRole = await User.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    }
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      growth: userGrowth,
      byRole: usersByRole
    }
  });
});

// Get auction analytics (admin only)
const getAuctionAnalytics = asyncHandler(async (req, res) => {
  const Auction = require('../models/Auction');
  const { startDate, endDate } = req.query;
  
  // Parse dates or use defaults
  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 6));
  const end = endDate ? new Date(endDate) : new Date();
  
  // Get auctions by status
  const auctionsByStatus = await Auction.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  // Get auctions by date
  const auctionsByDate = await Auction.aggregate([
    { 
      $match: { 
        createdAt: { $gte: start, $lte: end }
      } 
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        active: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  // Get average auction duration
  const avgDuration = await Auction.aggregate([
    {
      $match: {
        status: 'completed',
        endDate: { $exists: true },
        createdAt: { $exists: true }
      }
    },
    {
      $project: {
        duration: { $subtract: ['$endDate', '$createdAt'] }
      }
    },
    {
      $group: {
        _id: null,
        avgDurationMs: { $avg: '$duration' }
      }
    }
  ]);
  
  const avgDurationDays = avgDuration.length > 0 
    ? (avgDuration[0].avgDurationMs / (1000 * 60 * 60 * 24)).toFixed(2)
    : 0;
  
  res.status(200).json({
    success: true,
    data: {
      byStatus: auctionsByStatus,
      byDate: auctionsByDate,
      avgDurationDays
    }
  });
});

module.exports = {
  getAdminDashboard,
  getSellerDashboard,
  getItemAnalytics,
  getUserGrowthAnalytics,
  getAuctionAnalytics
};