// services/analyticsService.js
const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const Item = require('../models/Item');
const User = require('../models/User');
const Bid = require('../models/Bid');
//const Order = require('../models/Order'); // If you have an Order model

// Helper function to get date range
const getDateRange = (period) => {
  const now = new Date();
  const startDate = new Date();
  
  switch(period) {
    case 'day':
      startDate.setDate(now.getDate() - 1);
      break;
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setDate(now.getDate() - 30); // Default to 30 days
  }
  
  return { startDate, endDate: now };
};

// Admin Analytics
const getAdminDashboardStats = async (period = 'month') => {
  const { startDate, endDate } = getDateRange(period);
  
  // Get user statistics
  const totalUsers = await User.countDocuments();
  const newUsers = await User.countDocuments({
    createdAt: { $gte: startDate, $lte: endDate }
  });
  
  // Get auction statistics
  const totalAuctions = await Auction.countDocuments();
  const activeAuctions = await Auction.countDocuments({ status: 'active' });
  const completedAuctions = await Auction.countDocuments({ 
    status: 'completed',
    updatedAt: { $gte: startDate, $lte: endDate }
  });
  
  // Get bid statistics
  const totalBids = await Bid.countDocuments({
    createdAt: { $gte: startDate, $lte: endDate }
  });
  const avgBidsPerAuction = await Bid.aggregate([
    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
    { $group: { _id: '$auction', count: { $sum: 1 } } },
    { $group: { _id: null, avg: { $avg: '$count' } } }
  ]);
  
  // Get revenue statistics (if you have an Order model)
  let totalRevenue = 0;
  let periodRevenue = 0;
  
  if (mongoose.models.Order) {
    const revenueStats = await mongoose.models.Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    const periodRevenueStats = await mongoose.models.Order.aggregate([
      { 
        $match: { 
          paymentStatus: 'paid',
          createdAt: { $gte: startDate, $lte: endDate }
        } 
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    totalRevenue = revenueStats.length > 0 ? revenueStats[0].total : 0;
    periodRevenue = periodRevenueStats.length > 0 ? periodRevenueStats[0].total : 0;
  }
  
  // Get top categories
  const topCategories = await Item.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
    { 
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'categoryDetails'
      }
    },
    { $unwind: '$categoryDetails' },
    { 
      $project: { 
        _id: 1, 
        name: '$categoryDetails.name',
        count: 1
      }
    }
  ]);
  
  // Get sales by date
  const salesByDate = [];
  if (mongoose.models.Order) {
    const salesData = await mongoose.models.Order.aggregate([
      { 
        $match: { 
          paymentStatus: 'paid',
          createdAt: { $gte: startDate, $lte: endDate }
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          sales: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    salesByDate.push(...salesData);
  }
  
  return {
    users: {
      total: totalUsers,
      new: newUsers,
      growth: totalUsers > 0 ? (newUsers / totalUsers * 100).toFixed(2) : 0
    },
    auctions: {
      total: totalAuctions,
      active: activeAuctions,
      completed: completedAuctions
    },
    bids: {
      total: totalBids,
      avgPerAuction: avgBidsPerAuction.length > 0 ? avgBidsPerAuction[0].avg.toFixed(2) : 0
    },
    revenue: {
      total: totalRevenue,
      period: periodRevenue,
      growth: totalRevenue > 0 ? ((periodRevenue / totalRevenue) * 100).toFixed(2) : 0
    },
    topCategories,
    salesByDate
  };
};

// Seller Analytics
const getSellerStats = async (sellerId, period = 'month') => {
  const { startDate, endDate } = getDateRange(period);
  
  // Get seller's auctions
  const totalAuctions = await Auction.countDocuments({ seller: sellerId });
  const activeAuctions = await Auction.countDocuments({ 
    seller: sellerId,
    status: 'active'
  });
  const completedAuctions = await Auction.countDocuments({ 
    seller: sellerId,
    status: 'completed',
    updatedAt: { $gte: startDate, $lte: endDate }
  });
  
  // Get auction success rate
  const successfulAuctions = await Auction.countDocuments({
    seller: sellerId,
    status: 'completed',
    winningBidder: { $exists: true, $ne: null }
  });
  
  const successRate = totalAuctions > 0 ? (successfulAuctions / totalAuctions * 100).toFixed(2) : 0;
  
  // Get bid statistics for seller's auctions
  const sellerAuctionIds = await Auction.find({ seller: sellerId }).distinct('_id');
  
  const totalBids = await Bid.countDocuments({
    auction: { $in: sellerAuctionIds },
    createdAt: { $gte: startDate, $lte: endDate }
  });
  
  const avgBidsPerAuction = await Bid.aggregate([
    { 
      $match: { 
        auction: { $in: sellerAuctionIds },
        createdAt: { $gte: startDate, $lte: endDate }
      } 
    },
    { $group: { _id: '$auction', count: { $sum: 1 } } },
    { $group: { _id: null, avg: { $avg: '$count' } } }
  ]);
  
  // Get revenue statistics (if you have an Order model)
  let totalRevenue = 0;
  let periodRevenue = 0;
  
  if (mongoose.models.Order) {
    // This assumes your Order model has a seller field or can be linked to auctions
    // Adjust this query based on your actual data model
    const revenueStats = await mongoose.models.Order.aggregate([
      { 
        $match: { 
          seller: mongoose.Types.ObjectId(sellerId),
          paymentStatus: 'paid'
        } 
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    const periodRevenueStats = await mongoose.models.Order.aggregate([
      { 
        $match: { 
          seller: mongoose.Types.ObjectId(sellerId),
          paymentStatus: 'paid',
          createdAt: { $gte: startDate, $lte: endDate }
        } 
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    totalRevenue = revenueStats.length > 0 ? revenueStats[0].total : 0;
    periodRevenue = periodRevenueStats.length > 0 ? periodRevenueStats[0].total : 0;
  }
  
  // Get top performing items
  const topItems = await Auction.aggregate([
    { $match: { seller: mongoose.Types.ObjectId(sellerId), status: 'completed' } },
    { $sort: { currentPrice: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'items',
        localField: 'item',
        foreignField: '_id',
        as: 'itemDetails'
      }
    },
    { $unwind: '$itemDetails' },
    {
      $project: {
        _id: 1,
        title: '$itemDetails.title',
        finalPrice: '$currentPrice',
        endDate: 1
      }
    }
  ]);
  
  // Get auction performance over time
  const auctionsByDate = await Auction.aggregate([
    { 
      $match: { 
        seller: mongoose.Types.ObjectId(sellerId),
        createdAt: { $gte: startDate, $lte: endDate }
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
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  return {
    auctions: {
      total: totalAuctions,
      active: activeAuctions,
      completed: completedAuctions,
      successRate: successRate
    },
    bids: {
      total: totalBids,
      avgPerAuction: avgBidsPerAuction.length > 0 ? avgBidsPerAuction[0].avg.toFixed(2) : 0
    },
    revenue: {
      total: totalRevenue,
      period: periodRevenue,
      growth: totalRevenue > 0 ? ((periodRevenue / totalRevenue) * 100).toFixed(2) : 0
    },
    topItems,
    auctionsByDate
  };
};

// Get item performance analytics
const getItemAnalytics = async (itemId) => {
  // Find all auctions for this item
  const auctions = await Auction.find({ item: itemId })
    .populate('bids')
    .sort('-createdAt');
  
  // Calculate view to bid ratio, if you track views
  let viewCount = 0;
  // If you have a view tracking system, get the view count here
  
  const bidCount = await Bid.countDocuments({
    auction: { $in: auctions.map(a => a._id) }
  });
  
  const viewToBidRatio = viewCount > 0 ? (bidCount / viewCount).toFixed(2) : 0;
  
  // Calculate average final price
  const completedAuctions = auctions.filter(a => a.status === 'completed');
  const avgFinalPrice = completedAuctions.length > 0 
    ? completedAuctions.reduce((sum, auction) => sum + auction.currentPrice, 0) / completedAuctions.length
    : 0;
  
  // Calculate average bids per auction
  const avgBidsPerAuction = auctions.length > 0
    ? bidCount / auctions.length
    : 0;
  
  // Get bid history over time
  const bidHistory = await Bid.aggregate([
    { 
      $match: { 
        auction: { $in: auctions.map(a => mongoose.Types.ObjectId(a._id)) }
      } 
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  return {
    auctionCount: auctions.length,
    completedAuctionCount: completedAuctions.length,
    bidCount,
    viewCount,
    viewToBidRatio,
    avgFinalPrice,
    avgBidsPerAuction,
    bidHistory,
    auctions: auctions.map(auction => ({
      id: auction._id,
      startPrice: auction.startPrice,
      currentPrice: auction.currentPrice,
      bidCount: auction.bids.length,
      status: auction.status,
      createdAt: auction.createdAt,
      endDate: auction.endDate
    }))
  };
};

module.exports = {
  getAdminDashboardStats,
  getSellerStats,
  getItemAnalytics
};