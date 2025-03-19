const Auction = require("../models/Auction");
const AuctionWatch = require("../models/auction-watch-model");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

// Create a new auction
const createAuction = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      images,
      category,
      startingPrice,
      minBidIncrement,
      startTime,
      endTime,
    } = req.body;

    // Check that end time is after start time
    if (new Date(endTime) <= new Date(startTime)) {
      return res.status(400).json({
        message: "End time must be after start time",
      });
    }

    // Create new auction
    const newAuction = new Auction({
      title,
      description,
      images: images || [],
      category,
      startingPrice,
      currentPrice: startingPrice,
      minBidIncrement: minBidIncrement || 10,
      seller: req.user.userId, // From auth middleware
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    });

    await newAuction.save();

    res.status(201).json({
      message: "Auction created successfully",
      auction: newAuction,
    });
  } catch (error) {
    console.error("Error creating auction:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all auctions with filtering options
const getAllAuctions = async (req, res) => {
  try {
    const {
      status,
      category,
      minPrice,
      maxPrice,
      sort = "createdAt",
      order = "desc",
      page = 1,
      limit = 10,
      seller,
      search,
    } = req.query;

    // Build filter object
    const filter = {};

    // Add filters if provided
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (seller) filter.seller = seller;

    // Price range
    if (minPrice || maxPrice) {
      filter.currentPrice = {};
      if (minPrice) filter.currentPrice.$gte = Number(minPrice);
      if (maxPrice) filter.currentPrice.$lte = Number(maxPrice);
    }

    // Search in title and description
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Count total before pagination
    const total = await Auction.countDocuments(filter);

    // Query with filters, sorting and pagination
    const auctions = await Auction.find(filter)
      .sort({ [sort]: order === "asc" ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("seller", "username first_name last_name")
      .populate("winner", "username first_name last_name");

    // Calculate active status and time remaining for each auction
    const now = new Date();
    const auctionsWithDetails = auctions.map((auction) => {
      const auctionObj = auction.toObject({ virtuals: true });

      // Add bid count
      auctionObj.bidCount = auction.bids ? auction.bids.length : 0;

      // Format time remaining in a more readable way
      if (auctionObj.isActive) {
        const msRemaining = auction.endTime - now;
        const seconds = Math.floor((msRemaining / 1000) % 60);
        const minutes = Math.floor((msRemaining / (1000 * 60)) % 60);
        const hours = Math.floor((msRemaining / (1000 * 60 * 60)) % 24);
        const days = Math.floor(msRemaining / (1000 * 60 * 60 * 24));

        auctionObj.formattedTimeRemaining = `${days}d ${hours}h ${minutes}m ${seconds}s`;
      }

      return auctionObj;
    });

    res.status(200).json({
      auctions: auctionsWithDetails,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching auctions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get a single auction by ID
const getAuctionById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid auction ID" });
    }

    // Increment view count
    await Auction.findByIdAndUpdate(id, { $inc: { views: 1 } });

    // Get auction with populated fields
    const auction = await Auction.findById(id)
      .populate("seller", "username first_name last_name email")
      .populate("winner", "username first_name last_name")
      .populate("bids.bidder", "username first_name last_name");

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // Check if the user is watching this auction
    let isWatching = false;
    if (req.user) {
      const watch = await AuctionWatch.findOne({
        user: req.user.userId,
        auction: id,
      });
      isWatching = !!watch;
    }

    // Convert to object and add virtual properties
    const auctionObj = auction.toObject({ virtuals: true });
    auctionObj.isWatching = isWatching;

    // Format time remaining
    if (auctionObj.isActive) {
      const now = new Date();
      const msRemaining = auction.endTime - now;
      const seconds = Math.floor((msRemaining / 1000) % 60);
      const minutes = Math.floor((msRemaining / (1000 * 60)) % 60);
      const hours = Math.floor((msRemaining / (1000 * 60 * 60)) % 24);
      const days = Math.floor(msRemaining / (1000 * 60 * 60 * 24));

      auctionObj.formattedTimeRemaining = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }

    res.status(200).json(auctionObj);
  } catch (error) {
    console.error("Error fetching auction:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update an auction
const updateAuction = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      title,
      description,
      images,
      category,
      startingPrice,
      minBidIncrement,
      startTime,
      endTime,
      status,
    } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid auction ID" });
    }

    // Find the auction
    const auction = await Auction.findById(id);

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // Check if user is the seller
    if (auction.seller.toString() !== req.user.userId) {
      return res.status(403).json({
        message: "Unauthorized: Only the seller can update this auction",
      });
    }

    // Check if auction already has bids
    if (auction.bids.length > 0) {
      // If there are bids, limit what can be updated
      const updatableFields = ["description", "images", "endTime", "status"];
      const updateData = {};

      Object.keys(req.body).forEach((key) => {
        if (updatableFields.includes(key)) {
          updateData[key] = req.body[key];
        }
      });

      // Can only extend end time, not reduce it
      if (
        updateData.endTime &&
        new Date(updateData.endTime) < auction.endTime
      ) {
        return res.status(400).json({
          message: "Cannot reduce end time for an auction with bids",
        });
      }

      // Update only allowed fields
      const updatedAuction = await Auction.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      return res.status(200).json({
        message:
          "Auction updated successfully (limited fields due to existing bids)",
        auction: updatedAuction,
      });
    } else {
      // If no bids, can update all fields
      // Check that end time is after start time
      if (startTime && endTime && new Date(endTime) <= new Date(startTime)) {
        return res.status(400).json({
          message: "End time must be after start time",
        });
      }

      // Update all fields
      const updateData = {
        title,
        description,
        images,
        category,
        startingPrice,
        minBidIncrement,
        startTime: startTime ? new Date(startTime) : auction.startTime,
        endTime: endTime ? new Date(endTime) : auction.endTime,
        status,
      };

      // If starting price is updated, also update current price
      if (startingPrice && auction.currentPrice === auction.startingPrice) {
        updateData.currentPrice = startingPrice;
      }

      const updatedAuction = await Auction.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      return res.status(200).json({
        message: "Auction updated successfully",
        auction: updatedAuction,
      });
    }
  } catch (error) {
    console.error("Error updating auction:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete an auction
const deleteAuction = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid auction ID" });
    }

    // Find the auction
    const auction = await Auction.findById(id);

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // Check if user is the seller
    if (
      auction.seller.toString() !== req.user.userId &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        message:
          "Unauthorized: Only the seller or admin can delete this auction",
      });
    }

    // Check if auction already has bids
    if (auction.bids.length > 0 && auction.status === "active") {
      // Instead of deleting, cancel the auction
      auction.status = "cancelled";
      await auction.save();

      return res.status(200).json({
        message:
          "Auction cancelled successfully (not deleted due to existing bids)",
      });
    } else {
      // If no bids or not active, can delete
      await Auction.findByIdAndDelete(id);

      // Also delete all watches for this auction
      await AuctionWatch.deleteMany({ auction: id });

      return res.status(200).json({
        message: "Auction deleted successfully",
      });
    }
  } catch (error) {
    console.error("Error deleting auction:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Place a bid
const placeBid = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { amount } = req.body;
    const bidderId = req.user.userId;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid auction ID" });
    }

    // Find the auction
    const auction = await Auction.findById(id).populate(
      "seller",
      "username email"
    );

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // Check if auction is active
    if (auction.status !== "active") {
      return res.status(400).json({
        message: `Cannot place bid: auction is ${auction.status}`,
      });
    }

    // Check if auction has started and not ended
    const now = new Date();
    if (now < auction.startTime) {
      return res.status(400).json({
        message: "Cannot place bid: auction has not started yet",
      });
    }
    if (now > auction.endTime) {
      return res.status(400).json({
        message: "Cannot place bid: auction has already ended",
      });
    }

    // Check if seller is trying to bid on their own auction
    if (auction.seller._id.toString() === bidderId) {
      return res.status(400).json({
        message: "Cannot bid on your own auction",
      });
    }

    // Check if bid amount is high enough
    const minValidBid = auction.currentPrice + auction.minBidIncrement;
    if (amount < minValidBid) {
      return res.status(400).json({
        message: `Bid must be at least ${minValidBid}`,
        currentPrice: auction.currentPrice,
        minValidBid,
      });
    }

    // Add the bid and update current price
    const newBid = {
      bidder: bidderId,
      amount: amount,
      timestamp: now,
    };

    auction.bids.push(newBid);
    auction.currentPrice = amount;
    await auction.save();

    // Get previous highest bidder to notify them
    let prevHighestBidder = null;
    if (auction.bids.length > 1) {
      const sortedBids = [...auction.bids].sort((a, b) => b.amount - a.amount);

      // The second highest bid is now outbid
      if (sortedBids.length >= 2) {
        prevHighestBidder = sortedBids[1].bidder;
      }
    }

    // In a real app, you would emit an event via websockets here
    // For demonstration, we'll just log it
    console.log(
      `New bid placed on auction ${auction.title}: ${amount} by user ${bidderId}`
    );

    // This would be a websocket emit in a real implementation:
    // io.to(`auction_${id}`).emit('newBid', { auction: id, amount, bidder: bidderId });

    // Also notify watchers (simplified here)
    // In a real app, you'd use a message queue for notifications

    // Find all users watching this auction for outbid notifications
    const watchers = await AuctionWatch.find({
      auction: id,
      "notifications.outbid": true,
    }).populate("user", "email");

    // Here you'd send notifications to watchers and the previous highest bidder

    res.status(200).json({
      message: "Bid placed successfully",
      bid: newBid,
      currentPrice: auction.currentPrice,
    });
  } catch (error) {
    console.error("Error placing bid:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Toggle watching an auction
const toggleWatchAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid auction ID" });
    }

    // Check if auction exists
    const auction = await Auction.findById(id);
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // Check if user is already watching
    const existingWatch = await AuctionWatch.findOne({
      user: userId,
      auction: id,
    });

    if (existingWatch) {
      // User is already watching, so unwatch
      await AuctionWatch.deleteOne({ _id: existingWatch._id });

      // Decrement watch count
      await Auction.findByIdAndUpdate(id, { $inc: { watchCount: -1 } });

      return res.status(200).json({
        message: "Auction removed from watchlist",
        watching: false,
      });
    } else {
      // User is not watching, so add watch
      const newWatch = new AuctionWatch({
        user: userId,
        auction: id,
      });

      await newWatch.save();

      // Increment watch count
      await Auction.findByIdAndUpdate(id, { $inc: { watchCount: 1 } });

      return res.status(200).json({
        message: "Auction added to watchlist",
        watching: true,
      });
    }
  } catch (error) {
    console.error("Error toggling watch status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get user's watched auctions
const getWatchedAuctions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;

    // Find watches for this user
    const watches = await AuctionWatch.find({ user: userId })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await AuctionWatch.countDocuments({ user: userId });

    // Get the auction IDs
    const auctionIds = watches.map((watch) => watch.auction);

    // Get the auctions
    const auctions = await Auction.find({ _id: { $in: auctionIds } })
      .populate("seller", "username first_name last_name")
      .populate("winner", "username first_name last_name");

    // Add isWatching flag
    const auctionsWithWatchStatus = auctions.map((auction) => {
      const auctionObj = auction.toObject({ virtuals: true });
      auctionObj.isWatching = true;
      return auctionObj;
    });

    res.status(200).json({
      auctions: auctionsWithWatchStatus,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching watched auctions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get auctions for dashboard
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get counts for user's auctions by status
    const statusCounts = await Auction.aggregate([
      { $match: { seller: mongoose.Types.ObjectId(userId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Format status counts
    const formattedStatusCounts = {};
    statusCounts.forEach((item) => {
      formattedStatusCounts[item._id] = item.count;
    });

    // Get total bids placed on user's auctions
    const bidStats = await Auction.aggregate([
      { $match: { seller: mongoose.Types.ObjectId(userId) } },
      { $project: { bidCount: { $size: "$bids" } } },
      { $group: { _id: null, totalBids: { $sum: "$bidCount" } } },
    ]);

    // Get auctions won by user
    const wonAuctions = await Auction.countDocuments({
      winner: userId,
      status: "ended",
    });

    // Get total bids placed by user
    const bidsPlaced = await Auction.aggregate([
      { $unwind: "$bids" },
      { $match: { "bids.bidder": mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      auctionCounts: {
        total: Object.values(formattedStatusCounts).reduce((a, b) => a + b, 0),
        active: formattedStatusCounts.active || 0,
        ended: formattedStatusCounts.ended || 0,
        pending: formattedStatusCounts.pending || 0,
        cancelled: formattedStatusCounts.cancelled || 0,
      },
      bidStats: {
        bidsReceived: bidStats.length > 0 ? bidStats[0].totalBids : 0,
        bidsPlaced: bidsPlaced.length > 0 ? bidsPlaced[0].count : 0,
      },
      auctionsWon: wonAuctions,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  createAuction,
  getAllAuctions,
  getAuctionById,
  updateAuction,
  deleteAuction,
  placeBid,
  toggleWatchAuction,
  getWatchedAuctions,
  getDashboardStats,
};
