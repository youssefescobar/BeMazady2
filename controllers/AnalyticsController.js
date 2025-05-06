const Order = require("../models/Order");
const User = require("../models/User");
const Item = require("../models/Item");
const Auction = require("../models/Auction");
const asyncHandler = require("express-async-handler");

// ========== ADMIN CONTROLLERS ==========

// GET /api/analytics/admin/overview
exports.getAdminOverview = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const match = {
    status: "paid",
  };

  if (startDate && endDate) {
    match.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const orders = await Order.aggregate([
    { $match: match },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.itemType",
        totalRevenue: { $sum: "$items.priceAtPurchase" },
        profit: {
          $sum: {
            $cond: [
              { $eq: ["$items.itemType", "auction"] },
              { $multiply: ["$items.priceAtPurchase", 0.05] },
              { $multiply: ["$items.priceAtPurchase", 0.03] },
            ],
          },
        },
      },
    },
  ]);

  let totalRevenue = 0;
  let totalProfit = 0;
  const breakdown = {};

  orders.forEach((o) => {
    breakdown[o._id] = {
      revenue: o.totalRevenue,
      profit: o.profit,
    };
    totalRevenue += o.totalRevenue;
    totalProfit += o.profit;
  });

  res.json({
    totalRevenue,
    totalProfit,
    breakdown,
  });
});

// GET /api/analytics/admin/users?role=seller
exports.getUserCount = asyncHandler(async (req, res) => {
  const { role } = req.query;
  const filter = role ? { role } : {};
  const count = await User.countDocuments(filter);
  res.json({ count });
});

// GET /api/analytics/admin/items?status=available
exports.getItemCount = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = status ? { item_status: status } : {};
  const count = await Item.countDocuments(filter);
  res.json({ count });
});

// GET /api/analytics/admin/auctions?status=completed
exports.getAuctionCount = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};
  const count = await Auction.countDocuments(filter);
  res.json({ count });
});

// GET /api/analytics/admin/top-sellers
exports.getTopSellers = asyncHandler(async (req, res) => {
  const sellers = await Order.aggregate([
    { $match: { status: "paid" } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.seller",
        totalSales: { $sum: "$items.priceAtPurchase" },
        profit: {
          $sum: {
            $cond: [
              { $eq: ["$items.itemType", "auction"] },
              { $multiply: ["$items.priceAtPurchase", 0.05] },
              { $multiply: ["$items.priceAtPurchase", 0.03] },
            ],
          },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "seller",
      },
    },
    { $unwind: "$seller" },
    {
      $project: {
        username: "$seller.username",
        email: "$seller.email",
        totalSales: 1,
        profit: 1,
      },
    },
    { $sort: { totalSales: -1 } },
    { $limit: 10 },
  ]);

  res.json(sellers);
});

// ========== SELLER CONTROLLERS ==========

// GET /api/analytics/seller/overview
exports.getSellerOverview = asyncHandler(async (req, res) => {
  const sellerId = req.userId;

  const [itemCount, auctionCount] = await Promise.all([
    Item.countDocuments({ owner: sellerId }),
    Auction.countDocuments({ seller: sellerId }),
  ]);

  const orders = await Order.aggregate([
    { $match: { status: "paid" } },
    { $unwind: "$items" },
    { $match: { "items.seller": sellerId } },
    {
      $group: {
        _id: "$items.itemType",
        totalSold: { $sum: 1 },
        revenue: { $sum: "$items.priceAtPurchase" },
      },
    },
  ]);

  const stats = {
    itemCount,
    auctionCount,
    itemSold: 0,
    auctionSold: 0,
    revenue: 0,
  };

  orders.forEach((o) => {
    if (o._id === "item") stats.itemSold = o.totalSold;
    else if (o._id === "auction") stats.auctionSold = o.totalSold;
    stats.revenue += o.revenue;
  });

  res.json(stats);
});

// GET /api/analytics/seller/my-items?status=available&page=1&limit=10
exports.getMyItems = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const filter = { owner: req.userId };
  if (status) filter.item_status = status;

  const [total, items] = await Promise.all([
    Item.countDocuments(filter),
    Item.find(filter)
      .skip((page - 1) * limit)
      .limit(Number(limit)),
  ]);

  res.json({
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
    items,
  });
});

// GET /api/analytics/seller/my-auctions?status=completed&page=1&limit=10
exports.getMyAuctions = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const filter = { seller: req.userId };
  if (status) filter.status = status;

  const [total, auctions] = await Promise.all([
    Auction.countDocuments(filter),
    Auction.find(filter)
      .skip((page - 1) * limit)
      .limit(Number(limit)),
  ]);

  res.json({
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
    auctions,
  });
});
