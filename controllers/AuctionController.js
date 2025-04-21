const asyncHandler = require("express-async-handler");
const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const User = require("../models/User");
const { createNotification } = require("../controllers/NotificationController");
const upload = require("../middlewares/UploadMiddle");

const ApiFeatures = require("../utils/ApiFeatures");

// Create a new auction
const createAuction = asyncHandler(async (req, res) => {
  try {
    const {
      item,
      startPrice,
      reservePrice,
      buyNowPrice,
      minimumBidIncrement,
      endDate,
      description,
      title,
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Auction title is required",
      });
    }

    const seller = req.user.id;

    const auctionData = {
      item: item || null, // Optional
      seller,
      title,
      description: description || "",
      startPrice: Number(startPrice),
      currentPrice: Number(startPrice),
      status: "active",
    };

    if (reservePrice) auctionData.reservePrice = Number(reservePrice);
    if (buyNowPrice) auctionData.buyNowPrice = Number(buyNowPrice);
    if (minimumBidIncrement) auctionData.minimumBidIncrement = Number(minimumBidIncrement);
    if (endDate) auctionData.endDate = new Date(endDate);

    // ✅ Get Cloudinary image URLs from req.cloudinaryFiles
    const uploaded = req.cloudinaryFiles || {};

    if (!uploaded.auctionCover || uploaded.auctionCover.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Auction cover image is required",
      });
    }

    auctionData.auctionCover = uploaded.auctionCover[0];
    auctionData.auctionImages =
      uploaded.auctionImages?.length > 0
        ? uploaded.auctionImages
        : [uploaded.auctionCover[0]];

    const auction = await Auction.create(auctionData);

    const populatedAuction = await Auction.findById(auction._id)
      .populate("seller", "username _id")
      .populate("item", "name description");

    // ✅ Notify admin
    if (process.env.ADMIN_USER_ID) {
      await createNotification(
        req,
        process.env.ADMIN_USER_ID,
        `New auction "${auction.title}" has been created by seller ${req.user.username || req.user.id}`,
        "SYSTEM",
        null,
        { model: "Auction", id: auction._id }
      );
    }

    res.status(201).json({ success: true, data: populatedAuction });
  } catch (error) {
    console.error("Error creating auction:", error);
    res.status(500).json({ success: false, message: error.message });
  }
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

  // Get bidder information
  const bidder = await User.findById(req.body.bidder, "username");

  // Create notification for auction seller
  await createNotification(
    req,
    auction.seller._id,
    `${bidder.username} placed a bid of $${amount} on your auction "${auction.item}"`,
    "USER",
    req.body.bidder,
    { model: "Bid", id: bid._id }
  );

  // Find and notify other bidders they've been outbid
  const otherBidders = await Bid.find({
    auction: auction._id,
    bidder: { $ne: req.body.bidder },
  }).distinct("bidder");

  for (const bidderId of otherBidders) {
    await createNotification(
      req,
      bidderId,
      `Your bid on "${auction.item}" has been exceeded by a new bid of $${amount}`,
      "SYSTEM",
      null,
      { model: "Auction", id: auction._id }
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

  // Determine the highest bid
  let winningBidderId = null;
  let winningBidAmount = 0;

  if (auction.bids.length > 0) {
    const highestBid = await Bid.findOne({ auction: auction._id })
      .sort({ amount: -1 })
      .populate("bidder", "username _id");

    if (highestBid) {
      winningBidderId = highestBid.bidder._id;
      winningBidAmount = highestBid.amount;
      auction.winningBidder = winningBidderId;
    }
  }

  await auction.save();

  // Notify seller
  await createNotification(
    req,
    auction.seller._id,
    `Your auction "${auction.item}" has ended${
      winningBidderId
        ? ` with a winning bid of $${winningBidAmount}`
        : " with no bids"
    }`,
    "SYSTEM",
    null,
    { model: "Auction", id: auction._id }
  );

  // Notify winning bidder
  if (winningBidderId) {
    await createNotification(
      req,
      winningBidderId,
      `Congratulations! You won the auction for "${auction.item}" with your bid of $${winningBidAmount}`,
      "SYSTEM",
      null,
      { model: "Auction", id: auction._id }
    );

    // Notify other bidders
    const otherBidders = await Bid.find({
      auction: auction._id,
      bidder: { $ne: winningBidderId },
    }).distinct("bidder");

    for (const bidderId of otherBidders) {
      await createNotification(
        req,
        bidderId,
        `The auction for "${auction.item}" has ended. Your bid was not the winning bid.`,
        "SYSTEM",
        null,
        { model: "Auction", id: auction._id }
      );
    }
  }

  res.status(200).json({ success: true, data: auction });
});

const updateAuction = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let auction = await Auction.findById(id).populate("seller", "username _id");
  if (!auction) {
    return res.status(404).json({ success: false, message: "Auction not found" });
  }

  if (
    auction.seller._id.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return res.status(403).json({
      success: false,
      message: "You are not authorized to update this auction",
    });
  }

  if (["completed", "cancelled"].includes(auction.status)) {
    return res.status(400).json({
      success: false,
      message: "Cannot update a completed or cancelled auction",
    });
  }

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
      if (
        ["startPrice", "reservePrice", "buyNowPrice", "minimumBidIncrement"].includes(key)
      ) {
        auction[key] = Number(req.body[key]);
      } else if (key === "endDate") {
        auction[key] = new Date(req.body[key]);
      } else {
        auction[key] = req.body[key];
      }
      updates[key] = req.body[key];
    }
  });

  // ✅ Handle Cloudinary files from middleware
  const cloudFiles = req.cloudinaryFiles || {};

  if (cloudFiles.auctionCover && cloudFiles.auctionCover.length > 0) {
    auction.auctionCover = cloudFiles.auctionCover[0];
    updates.auctionCover = cloudFiles.auctionCover[0];
  }

  if (cloudFiles.auctionImages && cloudFiles.auctionImages.length > 0) {
    auction.auctionImages = cloudFiles.auctionImages;
    updates.auctionImages = cloudFiles.auctionImages;
  }

  auction = await auction.save();

  // Notify users
  const bidders = await Bid.find({ auction: auction._id }).distinct("bidder");

  if (req.body.status === "cancelled") {
    for (const bidderId of bidders) {
      await createNotification(
        req,
        bidderId,
        `The auction "${auction.item}" has been cancelled by the seller`,
        "SYSTEM",
        null,
        { model: "Auction", id: auction._id }
      );
    }
  } else if (Object.keys(updates).length > 0) {
    const updateItems = [];

    if (updates.endDate)
      updateItems.push(`end date changed to ${new Date(updates.endDate).toLocaleString()}`);
    if (updates.buyNowPrice)
      updateItems.push(`buy now price changed to $${updates.buyNowPrice}`);
    if (updates.minimumBidIncrement)
      updateItems.push(`minimum bid increment changed to $${updates.minimumBidIncrement}`);
    if (updates.auctionCover || updates.auctionImages)
      updateItems.push("auction images have been updated");

    const updateMessage = `The auction has been updated: ${updateItems.join(", ")}`;

    for (const bidderId of bidders) {
      await createNotification(req, bidderId, updateMessage, "SYSTEM", null, {
        model: "Auction",
        id: auction._id,
      });
    }
  }

  const populatedAuction = await Auction.findById(id)
    .populate("seller", "username _id")
    .populate("item", "name description");

  res.status(200).json({ success: true, data: populatedAuction });
});

const deleteAuction = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const auction = await Auction.findById(id);

  if (!auction) {
    return res
      .status(404)
      .json({ success: false, message: "Auction not found" });
  }

  // Check if user is authorized (owner or admin)
  if (auction.seller.toString() !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "You are not authorized to delete this auction",
    });
  }

  // Delete auction cover image if it exists
  if (auction.auctionCover) {
    const coverPath = path.join(__dirname, "..", auction.auctionCover);
    if (fs.existsSync(coverPath)) {
      fs.unlinkSync(coverPath);
      console.log(`✅ Deleted auction cover: ${coverPath}`);
    }
  }

  // Delete additional auction images if they exist
  if (auction.auctionImages && auction.auctionImages.length > 0) {
    auction.auctionImages.forEach((imagePath) => {
      // Skip if it's the same as cover image to avoid double deletion
      if (imagePath !== auction.auctionCover) {
        const fullPath = path.join(__dirname, "..", imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`✅ Deleted auction image: ${fullPath}`);
        }
      }
    });
  }

  // Notify bidders about the auction deletion
  const bidders = await Bid.find({
    auction: auction._id,
  }).distinct("bidder");

  for (const bidderId of bidders) {
    await createNotification(
      req,
      bidderId,
      `An auction you bid on has been deleted by the seller`,
      "SYSTEM",
      null,
      { model: "Auction", id: auction._id }
    );
  }

  // Delete related bids
  await Bid.deleteMany({ auction: auction._id });

  // Delete the auction
  await Auction.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: "Auction and related data successfully deleted",
  });
});

module.exports = {
  createAuction,
  placeBid,
  getAuction,
  getAllAuctions,
  endAuction,
  updateAuction,
  deleteAuction,
};
