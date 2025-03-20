const asyncHandler = require("express-async-handler");
const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const ApiFeatures = require("../utils/ApiFeatures");

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

  if (
    amount <
    (auction.currentPrice || auction.startPrice) + auction.minimumBidIncrement
  ) {
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
  let query = Auction.find()
    .populate({
      path: "item",
      select: "title description category subcategory",
      populate: [
        { path: "category", select: "name" }, 
        { path: "subcategory", select: "name" }, 
      ],
    })
    .populate({ path: "seller", select: "username email" })
    .populate({
      path: "bids",
      select: "amount bidder",
      populate: { path: "bidder", select: "username email" }, 
    });

  // Apply filtering based on category
  if (req.query.category) {
    query = query.find({ "item.category": req.query.category });
  }

  // Apply filtering based on subcategory
  if (req.query.subcategory) {
    query = query.find({ "item.subcategory": req.query.subcategory });
  }

  const features = new ApiFeatures(query, req.query)
    .filter("Auction")
    .sort()
    .limitFields()
    .paginate();

  // Get total count before pagination
  const totalAuctions = await Auction.countDocuments(
    features.query.getFilter()
  );

  // Apply pagination
  const auctions = await features.query;

  // Calculate total pages
  const limit = req.query.limit * 1 || 10;
  const totalPages = Math.ceil(totalAuctions / limit);

  res.status(200).json({
    results: auctions.length,
    totalAuctions,
    totalPages,
    currentPage: req.query.page * 1 || 1,
    data: auctions,
  });
});

// End an auction manually
const endAuction = asyncHandler(async (req, res) => {
  const auction = await Auction.findById(req.params.id).populate("bids");

  if (!auction) {
    return res
      .status(404)
      .json({ success: false, message: "Auction not found" });
  }

  if (!auction.bids.length) {
    // No bids were placed, mark the auction as completed with no winner
    auction.status = "completed";
    auction.winningBidder = null;
    await auction.save();

    return res.status(200).json({
      success: true,
      message: "Auction ended with no bids",
      data: auction,
    });
  }

  // Find the highest bid
  const highestBid = await Bid.findOne({ auction: auction.id })
    .sort({ amount: -1 }) // Sorting in descending order to get the highest bid
    .populate("bidder", "name email"); // Populate bidder details

  auction.status = "completed";
  auction.winningBidder = highestBid.bidder._id;
  await auction.save();

  res.status(200).json({
    success: true,
    message: "Auction ended successfully",
    data: {
      auctionId: auction._id,
      winningBidder: highestBid.bidder,
      winningAmount: highestBid.amount,
    },
  });
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
    return res.status(400).json({
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
