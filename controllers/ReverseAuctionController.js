
const ReverseAuction = require("../models/ReverseAuction");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const User = require("../models/User");
const Notification = require("../models/Notification");

// @desc    Create a new reverse auction
// @route   POST /api/reverseauctions
// @access  Private (Buyers only)
exports.createReverseAuction = asyncHandler(async (req, res) => {
    const {
      title,
      description,
      category,
      subcategory,
      startPrice,
      startDate,
      endDate,
      requirements,
      deliveryTime,
      location,
    } = req.body;
  
    // Buyer ID from the authenticated user
    const buyerId = req.user._id;
  
    // Create the reverse auction
    const reverseAuction = await ReverseAuction.create({
      title,
      description,
      buyerId,
      category,
      subcategory,
      startPrice,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      requirements,
      deliveryTime,
      location,
      status: "active", // Auto activate or can be set to pending for approval flow
    });
  
    // Return the created auction with its ID
    res.status(201).json({
      status: "success",
      data: reverseAuction  // Return the single object, not an array
    });
  });

// @desc    Get all reverse auctions
// @route   GET /api/reverseauctions
// @access  Public
exports.getAllReverseAuctions = asyncHandler(async (req, res) => {
    // Build query
    let query = {};
    
    // Filtering
    if (req.query.category) {
      query.category = req.query.category;
    }
    
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Only active and not expired auctions
    if (req.query.active === "true") {
      query.status = "active";
      query.endDate = { $gt: new Date() };
    }
  
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
  
    const reverseAuctions = await ReverseAuction.find(query)
      .populate("buyerId", "name email")
      .populate("category", "name")
      .populate("subcategory", "name")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
  
    // Count total documents for pagination metadata
    const totalAuctions = await ReverseAuction.countDocuments(query);
  
    res.status(200).json({
      status: "success",
      results: reverseAuctions.length,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalAuctions / limit),
        totalItems: totalAuctions,
      },
      data: reverseAuctions  // This is an array of auctions
    });
  });

// @desc    Get a specific reverse auction
// @route   GET /api/reverseauctions/:id
// @access  Public
exports.getReverseAuction = asyncHandler(async (req, res, next) => {
  const reverseAuction = await ReverseAuction.findById(req.params.id)
    .populate("buyerId", "name email profilePicture")
    .populate("category", "name")
    .populate("subcategory", "name")
    .populate("bids.sellerId", "name email profilePicture");

  if (!reverseAuction) {
    return next(new ApiError(`No reverse auction found with ID: ${req.params.id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: reverseAuction,
  });
});

// @desc    Update a reverse auction
// @route   PUT /api/reverseauctions/:id
// @access  Private (Owner only)
exports.updateReverseAuction = asyncHandler(async (req, res, next) => {
  const reverseAuction = await ReverseAuction.findById(req.params.id);

  if (!reverseAuction) {
    return next(new ApiError(`No reverse auction found with ID: ${req.params.id}`, 404));
  }

  // Check if the user is the owner
  if (reverseAuction.buyerId.toString() !== req.user._id.toString()) {
    return next(new ApiError("You are not authorized to update this reverse auction", 403));
  }

  // Don't allow updates if there are already bids
  if (reverseAuction.bids.length > 0 && (req.body.startPrice || req.body.endDate)) {
    return next(
      new ApiError("Cannot modify price or end date after bids have been placed", 400)
    );
  }

  // Update the reverse auction
  const updatedReverseAuction = await ReverseAuction.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: "success",
    data: updatedReverseAuction,
  });
});

// @desc    Delete a reverse auction
// @route   DELETE /api/reverseauctions/:id
// @access  Private (Owner only)
exports.deleteReverseAuction = asyncHandler(async (req, res, next) => {
  const reverseAuction = await ReverseAuction.findById(req.params.id);

  if (!reverseAuction) {
    return next(new ApiError(`No reverse auction found with ID: ${req.params.id}`, 404));
  }

  // Check if the user is the owner
  if (reverseAuction.buyerId.toString() !== req.user._id.toString()) {
    return next(
      new ApiError("You are not authorized to delete this reverse auction", 403)
    );
  }

  // Don't allow deletion if there are already bids
  if (reverseAuction.bids.length > 0) {
    return next(
      new ApiError("Cannot delete reverse auction after bids have been placed", 400)
    );
  }

  await ReverseAuction.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: "success",
    data: null,
  });
});

// @desc    Place a bid on a reverse auction
// @route   POST /api/reverseauctions/:id/bid
// @access  Private (Sellers only)
exports.placeBid = asyncHandler(async (req, res, next) => {
    const { price } = req.body;
    const sellerId = req.user._id;
  
    // Find the reverse auction
    const reverseAuction = await ReverseAuction.findById(req.params.id);
  
    if (!reverseAuction) {
      return next(new ApiError(`No reverse auction found with ID: ${req.params.id}`, 404));
    }
  
    // Check if auction is active
    if (reverseAuction.status !== "active") {
      return next(new ApiError("This reverse auction is not active", 400));
    }
  
    // Check if auction has not ended
    if (new Date(reverseAuction.endDate) < new Date()) {
      return next(new ApiError("This reverse auction has ended", 400));
    }
  
    // Check if the user is not the buyer
    if (reverseAuction.buyerId.toString() === sellerId.toString()) {
      return next(new ApiError("You cannot bid on your own reverse auction", 400));
    }
  
    // Check if bid price is valid (lower than start price or current lowest bid)
    let lowestBidPrice = reverseAuction.startPrice;
    if (reverseAuction.bids.length > 0) {
      const lowestBid = reverseAuction.bids.reduce(
        (min, bid) => (bid.price < min.price ? bid : min),
        reverseAuction.bids[0]
      );
      lowestBidPrice = lowestBid.price;
    }
  
    if (price >= lowestBidPrice) {
      return next(
        new ApiError(
          `Your bid must be lower than the current lowest bid: ${lowestBidPrice}`,
          400
        )
      );
    }
  
    let bidId;
  
    // Check if seller has already bid and update that bid instead of creating a new one
    const existingBidIndex = reverseAuction.bids.findIndex(
      (bid) => bid.sellerId.toString() === sellerId.toString()
    );
  
    if (existingBidIndex !== -1) {
      // Update existing bid
      reverseAuction.bids[existingBidIndex].price = price;
      reverseAuction.bids[existingBidIndex].createdAt = Date.now();
      bidId = reverseAuction.bids[existingBidIndex]._id; // Get existing bid ID
    } else {
      // Add new bid
      const newBid = {
        sellerId,
        price,
        createdAt: Date.now(),
      };
      reverseAuction.bids.push(newBid);
      await reverseAuction.save();
      
      // Find the newly created bid to get its ID
      const addedBid = reverseAuction.bids.find(
        bid => bid.sellerId.toString() === sellerId.toString() && 
               bid.price === price
      );
      bidId = addedBid._id;
    }
  
    // Only save once if updating existing bid (otherwise we already saved when adding new bid)
    if (existingBidIndex !== -1) {
      await reverseAuction.save();
    }
  
    // Send notification to the buyer
    await Notification.create({
      recipient: reverseAuction.buyerId,
      type: "info",
      title: "New Bid on Your Reverse Auction",
      message: `You received a new bid of $${price} on your reverse auction "${reverseAuction.title}"`,
      data: {
        reverseAuctionId: reverseAuction._id,
        sellerId: sellerId,
        notificationType: "new_reverse_bid"
      },
    });
    
    // Send real-time notification via socket.io if available
    const io = req.app.get("io");
    const connectedUsers = req.app.get("connectedUsers");
    
    if (io && connectedUsers[reverseAuction.buyerId]) {
      io.to(connectedUsers[reverseAuction.buyerId]).emit("new_notification", {
        type: "new_reverse_bid",
        title: "New Bid Received",
        message: `You received a new bid of $${price} on your reverse auction "${reverseAuction.title}"`,
        reverseAuctionId: reverseAuction._id,
      });
    }
  
    res.status(201).json({
      status: "success",
      message: "Bid placed successfully",
      data: {
        auctionId: reverseAuction._id,
        sellerId,
        price,
        bidId, // Include the bid ID in the response
      },
    });
  });
// @desc    Accept a bid on a reverse auction
// @route   POST /api/reverseauctions/:id/accept-bid/:bidId
// @access  Private (Owner only)
exports.acceptBid = asyncHandler(async (req, res, next) => {
  const { id, bidId } = req.params;
  const buyerId = req.user._id;

  // Find the reverse auction
  const reverseAuction = await ReverseAuction.findById(id);

  if (!reverseAuction) {
    return next(new ApiError(`No reverse auction found with ID: ${id}`, 404));
  }

  // Check if the user is the owner
  if (reverseAuction.buyerId.toString() !== buyerId.toString()) {
    return next(
      new ApiError("You are not authorized to accept bids on this reverse auction", 403)
    );
  }

  // Check if auction is active
  if (reverseAuction.status !== "active") {
    return next(new ApiError("This reverse auction is not active", 400));
  }

  // Find the bid
  const bid = reverseAuction.bids.id(bidId);

  if (!bid) {
    return next(new ApiError(`No bid found with ID: ${bidId}`, 404));
  }

  // Update the bid status to accepted
  bid.status = "accepted";

  // Update the auction status to completed and set winning bid
  reverseAuction.status = "completed";
  reverseAuction.winningBid = {
    sellerId: bid.sellerId,
    price: bid.price,
    acceptedAt: Date.now(),
  };

  await reverseAuction.save();

  // Send notification to the seller
  await Notification.create({
    recipient: bid.sellerId,
    type: "info", // Use a valid enum value
    title: "Your Bid was Accepted",
    message: `Your bid of $${bid.price} on reverse auction "${reverseAuction.title}" was accepted!`, // Changed from content to message
    data: {
      reverseAuctionId: reverseAuction._id,
    },
  });
  // Send real-time notification via socket.io if available
  const io = req.app.get("io");
  const connectedUsers = req.app.get("connectedUsers");
  
  if (io && connectedUsers[bid.sellerId]) {
    io.to(connectedUsers[bid.sellerId]).emit("new_notification", {
      type: "bid_accepted",
      title: "Bid Accepted",
      message: `Your bid on "${reverseAuction.title}" was accepted!`,
      reverseAuctionId: reverseAuction._id,
    });
  }

  res.status(200).json({
    status: "success",
    message: "Bid accepted successfully",
    data: {
      reverseAuction,
    },
  });
});

// @desc    Get all reverse auctions for the current user (as buyer)
// @route   GET /api/reverseauctions/my-auctions
// @access  Private
exports.getMyReverseAuctions = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const reverseAuctions = await ReverseAuction.find({ buyerId: userId })
    .populate("category", "name")
    .populate("subcategory", "name")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    results: reverseAuctions.length,
    data: reverseAuctions,
  });
});

// @desc    Get all reverse auctions where the current user has placed bids (as seller)
// @route   GET /api/reverseauctions/my-bids
// @access  Private
exports.getMyBids = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const reverseAuctions = await ReverseAuction.find({
    "bids.sellerId": userId,
  })
    .populate("buyerId", "name email")
    .populate("category", "name")
    .populate("subcategory", "name")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    results: reverseAuctions.length,
    data: reverseAuctions,
  });
});

// @desc    Cancel a reverse auction
// @route   PATCH /api/reverseauctions/:id/cancel
// @access  Private (Owner only)
exports.cancelReverseAuction = asyncHandler(async (req, res, next) => {
  const reverseAuction = await ReverseAuction.findById(req.params.id);

  if (!reverseAuction) {
    return next(new ApiError(`No reverse auction found with ID: ${req.params.id}`, 404));
  }

  // Check if the user is the owner
  if (reverseAuction.buyerId.toString() !== req.user._id.toString()) {
    return next(
      new ApiError("You are not authorized to cancel this reverse auction", 403)
    );
  }

  // Update status to cancelled
  reverseAuction.status = "cancelled";
  await reverseAuction.save();

  // Notify all bidders
  const bidders = [...new Set(reverseAuction.bids.map(bid => bid.sellerId.toString()))];
  
  for (const sellerId of bidders) {
    await Notification.create({
        recipient: sellerId,
        type: "info",
        title: "Reverse Auction Cancelled",
        message: `The reverse auction "${reverseAuction.title}" has been cancelled by the buyer.`, // Changed from content to message
        data: {
          reverseAuctionId: reverseAuction._id,
        },
      });
    // Send real-time notification via socket.io if available
    const io = req.app.get("io");
    const connectedUsers = req.app.get("connectedUsers");
    
    if (io && connectedUsers[sellerId]) {
      io.to(connectedUsers[sellerId]).emit("new_notification", {
        type: "auction_cancelled",
        title: "Auction Cancelled",
        message: `The reverse auction "${reverseAuction.title}" has been cancelled.`,
        reverseAuctionId: reverseAuction._id,
      });
    }
  }

  res.status(200).json({
    status: "success",
    message: "Reverse auction cancelled successfully",
    data: reverseAuction,
  });
});