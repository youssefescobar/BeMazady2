const asyncHandler = require("express-async-handler");
const Auction = require("../models/Auction");
const Bid = require("../models/Bid");

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

  res.status(201).json({ success: true, data: auction });
});

// Place a bid on an auction
const placeBid = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const auction = await Auction.findById(req.params.id).populate("bids");

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
  const auction = await Auction.findById(req.params.id);
  if (!auction) {
    return res
      .status(404)
      .json({ success: false, message: "Auction not found" });
  }

  auction.status = "completed";
  auction.winningBidder = auction.bids.length
    ? auction.bids[auction.bids.length - 1].bidder
    : null;
  await auction.save();

  res.status(200).json({ success: true, data: auction });
});

const updateAuction = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let auction = await Auction.findById(id);
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
  Object.keys(req.body).forEach((key) => {
    if (allowedFields.includes(key)) {
      auction[key] = req.body[key];
    }
  });

  auction = await auction.save();

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
