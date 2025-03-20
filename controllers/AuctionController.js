const asyncHandler = require("express-async-handler");
const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const User = require("../models/User");
const { createNotification } = require("../controllers/NotificationController");

// Create a new auction
const createAuction = asyncHandler(async (req, res) => {
  const {
    item,
    startPrice,
    reservePrice,
    buyNowPrice,
    minimumBidIncrement,
    endDate,
  } = req.body;
  
  const auction = await Auction.create({
    item,
    seller: req.body.seller,
    startPrice,
    reservePrice,
    buyNowPrice,
    minimumBidIncrement,
    endDate,
    status: "active",
  });

  // Notify admin about new auction creation
  await createNotification(
    req,
    process.env.ADMIN_USER_ID, // Assuming you have an admin user ID in env vars
    `New auction "${item}" has been created by seller ${req.body.seller}`,
    'SYSTEM',
    null,
    { model: 'Auction', id: auction._id }
  );
  
  res.status(201).json({ success: true, data: auction });
});

// Place a bid on an auction
const placeBid = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const auction = await Auction.findById(req.params.id)
    .populate("bids")
    .populate("seller", "username _id");

  if (!auction || auction.status !== "active") {
    return res
      .status(400)
      .json({ success: false, message: "Auction not found or not active" });
  }

  if (amount < auction.currentPrice + auction.minimumBidIncrement) {
    return res.status(400).json({ success: false, message: "Bid too low" });
  }

  const bid = await Bid.create({
    auction: auction.id,
    bidder: req.body.bidder,
    amount,
  });
  
  auction.bids.push(bid._id);
  auction.currentPrice = amount;
  await auction.save();

  // Get bidder information
  const bidder = await User.findById(req.body.bidder, "username");

  // Create notification for auction seller
  await createNotification(
    req,
    auction.seller._id,
    `${bidder.username} placed a bid of $${amount} on your auction "${auction.item}"`,
    'USER',
    req.body.bidder,
    { model: 'Bid', id: bid._id }
  );
  
  // Find and notify other bidders they've been outbid
  const otherBidders = await Bid.find({
    auction: auction._id,
    bidder: { $ne: req.body.bidder }
  }).distinct('bidder');
  
  for (const bidderId of otherBidders) {
    await createNotification(
      req,
      bidderId,
      `Your bid on "${auction.item}" has been exceeded by a new bid of $${amount}`,
      'SYSTEM',
      null,
      { model: 'Auction', id: auction._id }
    );
  }

  res.status(201).json({ success: true, data: bid });
});

// Get a single auction
const getAuction = asyncHandler(async (req, res) => {
  const auction = await Auction.findById(req.params.id).populate("bids");
  if (!auction) {
    return res
      .status(404)
      .json({ success: false, message: "Auction not found" });
  }
  res.status(200).json({ success: true, data: auction });
});

// Get all auctions
const getAllAuctions = asyncHandler(async (req, res) => {
  const auctions = await Auction.find().populate("bids");
  res.status(200).json({ success: true, data: auctions });
});

// End an auction manually
const endAuction = asyncHandler(async (req, res) => {
  const auction = await Auction.findById(req.params.id)
    .populate("bids")
    .populate("seller", "username _id");
    
  if (!auction) {
    return res
      .status(404)
      .json({ success: false, message: "Auction not found" });
  }

  auction.status = "completed";
  
  // Determine winning bidder
  let winningBidderId = null;
  let winningBidAmount = 0;
  
  if (auction.bids.length > 0) {
    const highestBid = await Bid.findOne({ auction: auction._id })
      .sort({ amount: -1 })
      .populate("bidder", "username _id");
      
    if (highestBid) {
      winningBidderId = highestBid.bidder._id;
      winningBidAmount = highestBid.amount;
      auction.winningBidder = highestBid.bidder._id;
    }
  }
  
  await auction.save();

  // Notify seller that auction has ended
  await createNotification(
    req,
    auction.seller._id,
    `Your auction "${auction.item}" has ended${winningBidderId ? ` with a winning bid of $${winningBidAmount}` : ' with no bids'}`,
    'SYSTEM',
    null,
    { model: 'Auction', id: auction._id }
  );
  
  // Notify winning bidder if there is one
  if (winningBidderId) {
    await createNotification(
      req,
      winningBidderId,
      `Congratulations! You won the auction for "${auction.item}" with your bid of $${winningBidAmount}`,
      'SYSTEM',
      null,
      { model: 'Auction', id: auction._id }
    );
    
    // Notify all other bidders they didn't win
    const otherBidders = await Bid.find({
      auction: auction._id,
      bidder: { $ne: winningBidderId }
    }).distinct('bidder');
    
    for (const bidderId of otherBidders) {
      await createNotification(
        req,
        bidderId,
        `The auction for "${auction.item}" has ended. Your bid was not the winning bid.`,
        'SYSTEM',
        null,
        { model: 'Auction', id: auction._id }
      );
    }
  }

  res.status(200).json({ success: true, data: auction });
});

const updateAuction = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let auction = await Auction.findById(id).populate("seller", "username _id");
  if (!auction) {
    return res
      .status(404)
      .json({ success: false, message: "Auction not found" });
  }

  // Prevent updating completed or cancelled auctions
  if (["completed", "cancelled"].includes(auction.status)) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Cannot update a completed or cancelled auction",
      });
  }

  // Update only allowed fields
  const allowedFields = [
    "startPrice",
    "reservePrice",
    "buyNowPrice",
    "minimumBidIncrement",
    "endDate",
    "status",
  ];
  
  const updates = {};
  Object.keys(req.body).forEach((key) => {
    if (allowedFields.includes(key)) {
      auction[key] = req.body[key];
      updates[key] = req.body[key];
    }
  });

  auction = await auction.save();
  
  // If status changed to cancelled, notify bidders
  if (req.body.status === "cancelled") {
    // Notify all bidders the auction was cancelled
    const bidders = await Bid.find({
      auction: auction._id
    }).distinct('bidder');
    
    for (const bidderId of bidders) {
      await createNotification(
        req,
        bidderId,
        `The auction "${auction.item}" has been cancelled by the seller`,
        'SYSTEM',
        null,
        { model: 'Auction', id: auction._id }
      );
    }
  } 
  // For other significant updates, notify existing bidders
  else if (Object.keys(updates).length > 0) {
    const bidders = await Bid.find({
      auction: auction._id
    }).distinct('bidder');
    
    // Format update message based on what changed
    let updateMessage = `The auction "${auction.item}" has been updated: `;
    const updateItems = [];
    
    if (updates.endDate) updateItems.push(`end date changed to ${new Date(updates.endDate).toLocaleString()}`);
    if (updates.buyNowPrice) updateItems.push(`buy now price changed to $${updates.buyNowPrice}`);
    if (updates.minimumBidIncrement) updateItems.push(`minimum bid increment changed to $${updates.minimumBidIncrement}`);
    
    updateMessage += updateItems.join(', ');
    
    for (const bidderId of bidders) {
      await createNotification(
        req,
        bidderId,
        updateMessage,
        'SYSTEM',
        null,
        { model: 'Auction', id: auction._id }
      );
    }
  }

  res.status(200).json({ success: true, data: auction });
});

module.exports = {
  createAuction,
  placeBid,
  getAuction,
  getAllAuctions,
  endAuction,
  updateAuction,
};