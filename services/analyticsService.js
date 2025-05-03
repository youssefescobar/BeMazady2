const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const Item = require('../models/Item');
const User = require('../models/User');
const Bid = require('../models/Bid');
const Order = require('../models/Order');
const Category = require('../models/category');

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
    case 'all':
      startDate.setFullYear(2000); // Far back date
      break;
    default:
      startDate.setDate(now.getDate() - 30); // Default to 30 days
  }
  
  return { startDate, endDate: now };
};

// Format date for grouping
const formatDateForGrouping = (date, groupBy) => {
  const d = new Date(date);
  switch(groupBy) {
    case 'day':
      return d.toISOString().split('T')[0];
    case 'week':
      return `${d.getFullYear()}-W${Math.ceil((d.getDate() + 6 - d.getDay()) / 7)}`;
    case 'month':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    case 'year':
      return d.getFullYear().toString();
    default:
      return d.toISOString().split('T')[0];
  }
};

// Main admin dashboard stats with commission tracking
const getAdminDashboardStats = async (period = 'month') => {
  const { startDate, endDate } = getDateRange(period);
  
  // User statistics
  const [totalUsers, newUsers, activeUsers] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
    User.countDocuments({ lastActive: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
  ]);

  // Auction statistics
  const [totalAuctions, activeAuctions, completedAuctions] = await Promise.all([
    Auction.countDocuments(),
    Auction.countDocuments({ status: 'active' }),
    Auction.countDocuments({ 
      status: 'completed',
      updatedAt: { $gte: startDate, $lte: endDate }
    })
  ]);

  // Bid statistics
  const [totalBids, avgBidsPerAuction] = await Promise.all([
    Bid.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
    Bid.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$auction', count: { $sum: 1 } } },
      { $group: { _id: null, avg: { $avg: '$count' } } }
    ])
  ]);

  // Financial statistics with commission tracking
  const financialStats = await Order.aggregate([
    { 
      $match: { 
        paymentStatus: 'paid',
        paidAt: { $gte: startDate, $lte: endDate }
      } 
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalCommission: { $sum: '$totalAdminCommission' },
        totalPayout: { $sum: '$totalSellerPayout' },
        orderCount: { $sum: 1 },
        itemCount: { $sum: { $size: '$items' } }
      }
    }
  ]);

  // Previous period for growth calculation
  const prevPeriod = await Order.aggregate([
    { 
      $match: { 
        paymentStatus: 'paid',
        paidAt: { 
          $gte: new Date(startDate.getTime() - (endDate - startDate)),
          $lt: startDate
        }
      } 
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalCommission: { $sum: '$totalAdminCommission' }
      }
    }
  ]);

  // Calculate growth rates
  const currentRevenue = financialStats[0]?.totalRevenue || 0;
  const prevRevenue = prevPeriod[0]?.totalRevenue || 0;
  const revenueGrowth = prevRevenue > 0 ? 
    ((currentRevenue - prevRevenue) / prevRevenue * 100).toFixed(2) : 0;

  // Top categories with revenue data
  const topCategories = await Item.aggregate([
    { 
      $match: { 
        createdAt: { $gte: startDate, $lte: endDate } 
      } 
    },
    {
      $lookup: {
        from: 'auctions',
        localField: '_id',
        foreignField: 'item',
        as: 'auctions'
      }
    },
    { $unwind: { path: '$auctions', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$category',
        itemCount: { $sum: 1 },
        auctionCount: { $sum: { $cond: [{ $ne: ['$auctions', null] }, 1, 0] } },
        totalRevenue: { $sum: { $ifNull: ['$auctions.currentPrice', 0] } }
      }
    },
    { $sort: { totalRevenue: -1 } },
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
        categoryId: '$_id',
        categoryName: '$categoryDetails.name',
        itemCount: 1,
        auctionCount: 1,
        totalRevenue: 1,
        avgRevenuePerItem: { $divide: ['$totalRevenue', '$itemCount'] }
      }
    }
  ]);

  // Top sellers with commission data
  const topSellers = await Order.aggregate([
    { 
      $match: { 
        paymentStatus: 'paid',
        paidAt: { $gte: startDate, $lte: endDate }
      } 
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.seller',
        totalSales: { $sum: '$items.priceAtPurchase' },
        totalCommission: { $sum: '$items.adminCommission' },
        totalPayout: { $sum: '$items.sellerPayout' },
        orderCount: { $sum: 1 },
        itemCount: { $sum: '$items.quantity' }
      }
    },
    { $sort: { totalSales: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'sellerDetails'
      }
    },
    { $unwind: '$sellerDetails' },
    {
      $project: {
        sellerId: '$_id',
        sellerName: '$sellerDetails.name',
        sellerEmail: '$sellerDetails.email',
        joinDate: '$sellerDetails.createdAt',
        totalSales: 1,
        totalCommission: 1,
        totalPayout: 1,
        orderCount: 1,
        itemCount: 1,
        avgSaleValue: { $divide: ['$totalSales', '$itemCount'] }
      }
    }
  ]);

  return {
    users: {
      total: totalUsers,
      new: newUsers,
      active: activeUsers,
      growthRate: totalUsers > 0 ? ((newUsers / totalUsers) * 100).toFixed(2) : 0
    },
    auctions: {
      total: totalAuctions,
      active: activeAuctions,
      completed: completedAuctions,
      completionRate: totalAuctions > 0 ? ((completedAuctions / totalAuctions) * 100).toFixed(2) : 0
    },
    bids: {
      total: totalBids,
      avgPerAuction: avgBidsPerAuction.length > 0 ? avgBidsPerAuction[0].avg.toFixed(2) : 0
    },
    financials: {
      totalRevenue: financialStats[0]?.totalRevenue || 0,
      totalCommission: financialStats[0]?.totalCommission || 0,
      totalPayout: financialStats[0]?.totalPayout || 0,
      orderCount: financialStats[0]?.orderCount || 0,
      itemCount: financialStats[0]?.itemCount || 0,
      avgOrderValue: financialStats[0]?.orderCount > 0 ? 
        (financialStats[0].totalRevenue / financialStats[0].orderCount).toFixed(2) : 0,
      revenueGrowth: parseFloat(revenueGrowth),
      commissionRate: 5 // 5% commission
    },
    topCategories,
    topSellers,
    timePeriod: {
      start: startDate,
      end: endDate
    }
  };
};

// Detailed financial report with commission breakdown
const getFinancialReport = async (startDate, endDate, groupBy = 'month') => {
  const dateFormat = formatDateForGrouping(new Date(), groupBy);
  
  const report = await Order.aggregate([
    { 
      $match: { 
        paymentStatus: 'paid',
        paidAt: { 
          $gte: new Date(startDate || '2020-01-01'), 
          $lte: new Date(endDate || new Date()) 
        }
      } 
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { 
            format: dateFormat.includes('W') ? '%Y-%U' : dateFormat.includes('-') ? '%Y-%m' : '%Y',
            date: '$paidAt' 
          }},
          period: groupBy
        },
        totalRevenue: { $sum: '$totalAmount' },
        totalCommission: { $sum: '$totalAdminCommission' },
        totalPayout: { $sum: '$totalSellerPayout' },
        orderCount: { $sum: 1 },
        itemCount: { $sum: { $size: '$items' } }
      }
    },
    { $sort: { '_id.date': 1 } },
    {
      $project: {
        _id: 0,
        period: '$_id.date',
        totalRevenue: 1,
        totalCommission: 1,
        totalPayout: 1,
        orderCount: 1,
        itemCount: 1,
        avgOrderValue: { $divide: ['$totalRevenue', '$orderCount'] },
        commissionRate: {
          $multiply: [
            { $divide: ['$totalCommission', '$totalRevenue'] },
            100
          ]
        }
      }
    }
  ]);

  return report;
};

// Seller analytics with commission tracking
const getSellerStats = async (sellerId, period = 'month') => {
  const { startDate, endDate } = getDateRange(period);
  
  // Seller information
  const seller = await User.findById(sellerId).select('name email createdAt');

  // Auction statistics
  const [totalAuctions, activeAuctions, completedAuctions] = await Promise.all([
    Auction.countDocuments({ seller: sellerId }),
    Auction.countDocuments({ seller: sellerId, status: 'active' }),
    Auction.countDocuments({ 
      seller: sellerId,
      status: 'completed',
      updatedAt: { $gte: startDate, $lte: endDate }
    })
  ]);

  // Successful auctions (with winning bidder)
  const successfulAuctions = await Auction.countDocuments({
    seller: sellerId,
    status: 'completed',
    winningBidder: { $exists: true, $ne: null }
  });

  // Financial statistics with commission
  const financialStats = await Order.aggregate([
    { 
      $match: { 
        'items.seller': new mongoose.Types.ObjectId(sellerId),
        paymentStatus: 'paid',
        paidAt: { $gte: startDate, $lte: endDate }
      } 
    },
    { $unwind: '$items' },
    { $match: { 'items.seller': new mongoose.Types.ObjectId(sellerId) } },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$items.priceAtPurchase' },
        totalCommission: { $sum: '$items.adminCommission' },
        totalPayout: { $sum: '$items.sellerPayout' },
        orderCount: { $sum: 1 },
        itemCount: { $sum: '$items.quantity' }
      }
    }
  ]);

  // Previous period for growth calculation
  const prevPeriodStats = await Order.aggregate([
    { 
      $match: { 
        'items.seller': new mongoose.Types.ObjectId(sellerId),
        paymentStatus: 'paid',
        paidAt: { 
          $gte: new Date(startDate.getTime() - (endDate - startDate)),
          $lt: startDate
        }
      } 
    },
    { $unwind: '$items' },
    { $match: { 'items.seller': new mongoose.Types.ObjectId(sellerId) } },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$items.priceAtPurchase' }
      }
    }
  ]);

  // Calculate growth
  const currentSales = financialStats[0]?.totalSales || 0;
  const prevSales = prevPeriodStats[0]?.totalSales || 0;
  const salesGrowth = prevSales > 0 ? 
    ((currentSales - prevSales) / prevSales * 100).toFixed(2) : 0;

  // Top performing items
  const topItems = await Order.aggregate([
    { 
      $match: { 
        'items.seller': new mongoose.Types.ObjectId(sellerId),
        paymentStatus: 'paid',
        paidAt: { $gte: startDate, $lte: endDate }
      } 
    },
    { $unwind: '$items' },
    { $match: { 'items.seller': new mongoose.Types.ObjectId(sellerId) } },
    {
      $group: {
        _id: '$items.item',
        totalSales: { $sum: '$items.priceAtPurchase' },
        totalCommission: { $sum: '$items.adminCommission' },
        totalPayout: { $sum: '$items.sellerPayout' },
        orderCount: { $sum: 1 },
        quantity: { $sum: '$items.quantity' }
      }
    },
    { $sort: { totalSales: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'items',
        localField: '_id',
        foreignField: '_id',
        as: 'itemDetails'
      }
    },
    { $unwind: '$itemDetails' },
    {
      $project: {
        itemId: '$_id',
        itemName: '$itemDetails.title',
        itemImage: '$itemDetails.images.0',
        totalSales: 1,
        totalCommission: 1,
        totalPayout: 1,
        orderCount: 1,
        quantity: 1,
        avgPrice: { $divide: ['$totalSales', '$quantity'] }
      }
    }
  ]);

  // Sales by date
  const salesByDate = await Order.aggregate([
    { 
      $match: { 
        'items.seller': new mongoose.Types.ObjectId(sellerId),
        paymentStatus: 'paid',
        paidAt: { $gte: startDate, $lte: endDate }
      } 
    },
    { $unwind: '$items' },
    { $match: { 'items.seller': new mongoose.Types.ObjectId(sellerId) } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } },
        totalSales: { $sum: '$items.priceAtPurchase' },
        totalCommission: { $sum: '$items.adminCommission' },
        orderCount: { $sum: 1 }
      }
    },
    { $sort: { '_id': 1 } }
  ]);

  return {
    sellerInfo: {
      name: seller?.name,
      email: seller?.email,
      joinDate: seller?.createdAt
    },
    auctions: {
      total: totalAuctions,
      active: activeAuctions,
      completed: completedAuctions,
      successRate: totalAuctions > 0 ? (successfulAuctions / totalAuctions * 100).toFixed(2) : 0
    },
    financials: {
      totalSales: currentSales,
      totalCommission: financialStats[0]?.totalCommission || 0,
      totalPayout: financialStats[0]?.totalPayout || 0,
      orderCount: financialStats[0]?.orderCount || 0,
      itemCount: financialStats[0]?.itemCount || 0,
      avgOrderValue: financialStats[0]?.orderCount > 0 ? 
        (currentSales / financialStats[0].orderCount).toFixed(2) : 0,
      salesGrowth: parseFloat(salesGrowth),
      commissionRate: 5 // 5% commission
    },
    topItems,
    salesByDate
  };
};

// Item performance analytics
const getItemAnalytics = async (itemId) => {
  const itemObjectId = new mongoose.Types.ObjectId(itemId);

  // Get item details
  const item = await Item.findById(itemId).select('title description images category');

  // Get all auctions for this item
  const auctions = await Auction.find({ item: itemObjectId })
    .populate('bids')
    .sort('-createdAt');

  // Calculate statistics
  const completedAuctions = auctions.filter(a => a.status === 'completed');
  const successfulAuctions = completedAuctions.filter(a => a.winningBidder);
  
  // Bid statistics
  const bidCount = await Bid.countDocuments({
    auction: { $in: auctions.map(a => a._id) }
  });

  // View statistics (if you have a view tracking system)
  const viewCount = 0; // Replace with actual view count if available

  // Financial statistics
  const totalRevenue = successfulAuctions.reduce((sum, a) => sum + a.currentPrice, 0);
  const avgFinalPrice = completedAuctions.length > 0 ? 
    totalRevenue / completedAuctions.length : 0;

  // Bid history over time
  const bidHistory = await Bid.aggregate([
    { 
      $match: { 
        auction: { $in: auctions.map(a => a._id) }
      } 
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' },
        maxAmount: { $max: '$amount' }
      }
    },
    { $sort: { '_id': 1 } }
  ]);

  // Category information
  const category = await Category.findById(item.category).select('name');

  return {
    itemDetails: {
      title: item.title,
      description: item.description,
      mainImage: item.images[0],
      category: category?.name || 'Uncategorized'
    },
    statistics: {
      auctionCount: auctions.length,
      completedAuctions: completedAuctions.length,
      successfulAuctions: successfulAuctions.length,
      successRate: auctions.length > 0 ? 
        (successfulAuctions.length / auctions.length * 100).toFixed(2) : 0,
      bidCount,
      viewCount,
      viewToBidRatio: viewCount > 0 ? (bidCount / viewCount).toFixed(2) : 0,
      totalRevenue,
      avgFinalPrice: avgFinalPrice.toFixed(2),
      avgBidsPerAuction: auctions.length > 0 ? 
        (bidCount / auctions.length).toFixed(2) : 0
    },
    bidHistory,
    auctions: auctions.map(a => ({
      id: a._id,
      startPrice: a.startPrice,
      finalPrice: a.currentPrice,
      status: a.status,
      startDate: a.createdAt,
      endDate: a.endDate,
      bidCount: a.bids?.length || 0,
      winner: a.winningBidder || null
    }))
  };
};

// Platform growth metrics
const getPlatformGrowth = async (startDate, endDate) => {
  const growthData = await Promise.all([
    // User growth
    User.aggregate([
      { 
        $match: { 
          createdAt: { 
            $gte: new Date(startDate || '2020-01-01'), 
            $lte: new Date(endDate || new Date()) 
          } 
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]),
    
    // Auction growth
    Auction.aggregate([
      { 
        $match: { 
          createdAt: { 
            $gte: new Date(startDate || '2020-01-01'), 
            $lte: new Date(endDate || new Date()) 
          } 
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]),
    
    // Revenue growth
    Order.aggregate([
      { 
        $match: { 
          paymentStatus: 'paid',
          paidAt: { 
            $gte: new Date(startDate || '2020-01-01'), 
            $lte: new Date(endDate || new Date()) 
          } 
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } },
          revenue: { $sum: '$totalAmount' },
          commission: { $sum: '$totalAdminCommission' }
        }
      },
      { $sort: { '_id': 1 } }
    ])
  ]);

  return {
    userGrowth: growthData[0],
    auctionGrowth: growthData[1],
    revenueGrowth: growthData[2]
  };
};

// Commission analytics
const getCommissionAnalytics = async (period = 'month', detailed = false) => {
  const { startDate, endDate } = getDateRange(period);
  
  const baseMatch = { 
    paymentStatus: 'paid',
    paidAt: { $gte: startDate, $lte: endDate }
  };

  const commissionData = await Order.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: detailed ? { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } } : null,
        totalRevenue: { $sum: '$totalAmount' },
        totalCommission: { $sum: '$totalAdminCommission' },
        totalPayout: { $sum: '$totalSellerPayout' },
        orderCount: { $sum: 1 }
      }
    },
    detailed ? { $sort: { '_id': 1 } } : { $match: {} },
    {
      $project: {
        date: detailed ? '$_id' : null,
        totalRevenue: 1,
        totalCommission: 1,
        totalPayout: 1,
        orderCount: 1,
        avgOrderValue: { $divide: ['$totalRevenue', '$orderCount'] },
        commissionRate: { 
          $multiply: [
            { $divide: ['$totalCommission', '$totalRevenue'] },
            100
          ]
        }
      }
    }
  ]);

  return detailed ? commissionData : commissionData[0] || {};
};

// Category analytics
const getCategoryAnalytics = async (period = 'month') => {
  const { startDate, endDate } = getDateRange(period);
  
  const categoryStats = await Item.aggregate([
    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
    {
      $lookup: {
        from: 'auctions',
        localField: '_id',
        foreignField: 'item',
        as: 'auctions'
      }
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryDetails'
      }
    },
    { $unwind: '$categoryDetails' },
    {
      $group: {
        _id: '$category',
        categoryName: { $first: '$categoryDetails.name' },
        itemCount: { $sum: 1 },
        auctionCount: { $sum: { $size: '$auctions' } },
        completedAuctions: {
          $sum: {
            $size: {
              $filter: {
                input: '$auctions',
                as: 'auction',
                cond: { $eq: ['$$auction.status', 'completed'] }
              }
            }
          }
        },
        totalRevenue: {
          $sum: {
            $sum: '$auctions.currentPrice'
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        categoryId: '$_id',
        categoryName: 1,
        itemCount: 1,
        auctionCount: 1,
        completedAuctions: 1,
        completionRate: {
          $cond: [
            { $eq: ['$auctionCount', 0] },
            0,
            { $divide: ['$completedAuctions', '$auctionCount'] }
          ]
        },
        totalRevenue: 1,
        avgRevenuePerItem: {
          $cond: [
            { $eq: ['$itemCount', 0] },
            0,
            { $divide: ['$totalRevenue', '$itemCount'] }
          ]
        }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);

  return categoryStats;
};

// Top sellers analytics
const getTopSellers = async (limit = 10, period = 'month') => {
  const { startDate, endDate } = getDateRange(period);
  
  const sellers = await Order.aggregate([
    { 
      $match: { 
        paymentStatus: 'paid',
        paidAt: { $gte: startDate, $lte: endDate }
      } 
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.seller',
        totalSales: { $sum: '$items.priceAtPurchase' },
        totalCommission: { $sum: '$items.adminCommission' },
        totalPayout: { $sum: '$items.sellerPayout' },
        orderCount: { $sum: 1 },
        itemCount: { $sum: '$items.quantity' }
      }
    },
    { $sort: { totalSales: -1 } },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'seller'
      }
    },
    { $unwind: '$seller' },
    {
      $project: {
        sellerId: '$_id',
        sellerName: '$seller.name',
        sellerEmail: '$seller.email',
        joinDate: '$seller.createdAt',
        totalSales: 1,
        totalCommission: 1,
        totalPayout: 1,
        orderCount: 1,
        itemCount: 1,
        avgSaleValue: { $divide: ['$totalSales', '$itemCount'] }
      }
    }
  ]);

  return sellers;
};

// Conversion metrics
const getConversionMetrics = async (period = 'month') => {
  const { startDate, endDate } = getDateRange(period);
  
  const metrics = await Promise.all([
    // View to bid conversion (if you have view tracking)
    // This is a placeholder - implement with your actual view data
    { viewCount: 0, bidCount: 0, conversionRate: 0 },
    
    // Auction to sale conversion
    Auction.aggregate([
      { 
        $match: { 
          createdAt: { $gte: startDate, $lte: endDate } 
        } 
      },
      {
        $group: {
          _id: null,
          totalAuctions: { $sum: 1 },
          completedAuctions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          successfulAuctions: {
            $sum: { $cond: [{ $and: [
              { $eq: ['$status', 'completed'] },
              { $ne: ['$winningBidder', null] }
            ] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalAuctions: 1,
          completedAuctions: 1,
          successfulAuctions: 1,
          completionRate: {
            $multiply: [
              { $divide: ['$completedAuctions', '$totalAuctions'] },
              100
            ]
          },
          successRate: {
            $multiply: [
              { $divide: ['$successfulAuctions', '$completedAuctions'] },
              100
            ]
          }
        }
      }
    ])
  ]);

  return {
    viewToBidConversion: metrics[0],
    auctionConversion: metrics[1][0] || {}
  };
};

const getAuctionAnalytics = async (startDate, endDate, groupBy = 'month') => {
  const dateFormat = formatDateForGrouping(new Date(), groupBy);
  
  const analytics = await Auction.aggregate([
    { 
      $match: { 
        createdAt: { 
          $gte: new Date(startDate || '2020-01-01'), 
          $lte: new Date(endDate || new Date()) 
        } 
      } 
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { 
            format: dateFormat.includes('W') ? '%Y-%U' : dateFormat.includes('-') ? '%Y-%m' : '%Y',
            date: '$createdAt' 
          }},
          status: '$status'
        },
        count: { $sum: 1 },
        totalStartPrice: { $sum: '$startPrice' },
        avgStartPrice: { $avg: '$startPrice' },
        totalFinalPrice: { 
          $sum: { 
            $cond: [
              { $eq: ['$status', 'completed'] },
              '$currentPrice',
              0
            ]
          }
        }
      }
    },
    {
      $group: {
        _id: '$_id.date',
        statuses: {
          $push: {
            status: '$_id.status',
            count: '$count'
          }
        },
        totalAuctions: { $sum: '$count' },
        totalStartValue: { $sum: '$totalStartPrice' },
        avgStartValue: { $avg: '$avgStartPrice' },
        totalFinalValue: { $sum: '$totalFinalPrice' }
      }
    },
    { $sort: { '_id': 1 } },
    {
      $project: {
        _id: 0,
        period: '$_id',
        statuses: 1,
        totalAuctions: 1,
        totalStartValue: 1,
        avgStartValue: 1,
        totalFinalValue: 1,
        avgFinalValue: {
          $cond: [
            { $gt: ['$totalFinalValue', 0] },
            { $divide: ['$totalFinalValue', { 
              $reduce: {
                input: '$statuses',
                initialValue: 0,
                in: {
                  $cond: [
                    { $eq: ['$$this.status', 'completed'] },
                    { $add: ['$$value', '$$this.count'] },
                    '$$value'
                  ]
                }
              }
            }] },
            0
          ]
        }
      }
    }
  ]);

  return analytics;
};

const getUserGrowthAnalytics = async (startDate, endDate, groupBy = 'month') => {
  const dateFormat = formatDateForGrouping(new Date(), groupBy);
  
  // User growth by time period
  const growthData = await User.aggregate([
    { 
      $match: { 
        createdAt: { 
          $gte: new Date(startDate || '2020-01-01'), 
          $lte: new Date(endDate || new Date()) 
        } 
      } 
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { 
            format: dateFormat.includes('W') ? '%Y-%U' : dateFormat.includes('-') ? '%Y-%m' : '%Y',
            date: '$createdAt' 
          }}
        },
        count: { $sum: 1 },
        verifiedUsers: {
          $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] }
        },
        activeUsers: {
          $sum: { $cond: [{ $gt: ['$lastActive', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] }, 1, 0] }
        }
      }
    },
    { $sort: { '_id.date': 1 } },
    {
      $project: {
        _id: 0,
        date: '$_id.date',
        newUsers: '$count',
        verifiedUsers: 1,
        activeUsers: 1,
        verificationRate: {
          $multiply: [
            { $divide: ['$verifiedUsers', '$count'] },
            100
          ]
        }
      }
    }
  ]);

  // User distribution by role
  const usersByRole = await User.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        verified: {
          $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        role: '$_id',
        count: 1,
        verified: 1,
        verificationRate: {
          $multiply: [
            { $divide: ['$verified', '$count'] },
            100
          ]
        }
      }
    }
  ]);

  return {
    growthOverTime: growthData,
    distributionByRole: usersByRole
  };
};


module.exports = {
  getAdminDashboardStats,
  getSellerStats,
  getUserGrowthAnalytics,
  getItemAnalytics,
  getFinancialReport,
  getAuctionAnalytics,
  getCommissionAnalytics,
  getTopSellers,
  getCategoryAnalytics,
  getPlatformGrowth,
  getConversionMetrics
};