const asyncHandler = require("express-async-handler");
const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const User = require("../models/User");
const { createNotification } = require("../controllers/NotificationController");
const upload = require("../middlewares/UploadMiddle");
const CategoryModel = require("../models/category");
const ApiFeatures = require("../utils/ApiFeatures");
const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const { createCheckoutSession } = require("./PaymentController");
const auctionEmails = require("../extra/Emaildb");
const mongoose = require("mongoose");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Create a new auction
const createAuction = asyncHandler(async (req, res) => {
  try {
    const {
      startPrice,
      reservePrice,
      buyNowPrice,
      minimumBidIncrement,
      endDate,
      description,
      title,
      category,
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Auction title is required",
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    // Verify the category exists
    const categoryExists = await CategoryModel.findById(category);
    if (!categoryExists) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const seller = req.user.id;

    const auctionData = {
      seller,
      title,
      description: description || "",
      startPrice: Number(startPrice),
      currentPrice: Number(startPrice),
      status: "active",
      category, // Add the category field
    };

    if (reservePrice) auctionData.reservePrice = Number(reservePrice);
    if (buyNowPrice) auctionData.buyNowPrice = Number(buyNowPrice);
    if (minimumBidIncrement)
      auctionData.minimumBidIncrement = Number(minimumBidIncrement);
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
      .populate("category", "name");

    // ✅ Notify admin
    if (process.env.ADMIN_USER_ID) {
      await createNotification(
        req,
        process.env.ADMIN_USER_ID,
        `New auction "${auction.title}" has been created by seller ${
          req.user.username || req.user.id
        }`,
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
    "SYSTEM",
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

const buyNowAuction = asyncHandler(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const userEmail = req.user.email;
    const auctionId = req.params.id;

    // 1. Validate auction
    const auction = await Auction.findById(auctionId)
      .populate("seller", "username _id email")
      .session(session);

    if (!auction) {
      await session.abortTransaction();
      return next(new ApiError("Auction not found", 404));
    }

    if (auction.status !== "active") {
      await session.abortTransaction();
      return next(new ApiError("Auction is not active", 400));
    }

    if (!auction.buyNowPrice) {
      await session.abortTransaction();
      return next(new ApiError("This auction does not have a Buy Now option", 400));
    }

    if (auction.seller._id.toString() === userId.toString()) {
      await session.abortTransaction();
      return next(new ApiError("You cannot buy your own auction", 400));
    }

    // 2. Check for existing purchase
    const existingBid = await Bid.findOne({
      auction: auctionId,
      amount: auction.buyNowPrice
    }).session(session);

    if (existingBid) {
      await session.abortTransaction();
      return next(new ApiError("This auction has already been purchased", 400));
    }

    // 3. Create order with temporary payment session
    const [order] = await Order.create([{
      user: userId,
      items: [{
        itemType: "auction",
        item: auctionId,
        quantity: 1,
        priceAtPurchase: auction.buyNowPrice,
        seller: auction.seller._id,
      }],
      totalAmount: auction.buyNowPrice,
      status: "pending",
      paymentSession: {
        sessionId: "temp_" + Date.now(),
        paymentUrl: "https://example.com/pending",
        expiresAt: new Date(Date.now() + 3600000) // 1 hour
      }
    }], { session });

    // 4. Create Stripe checkout session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: auction.title,
            description: `Buy Now: ${auction.title}`,
            images: [auction.auctionCover],
            metadata: { auctionId: auction._id.toString() }
          },
          unit_amount: Math.round(auction.buyNowPrice * 100),
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order._id}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel?order_id=${order._id}`,
      customer_email: userEmail,
      metadata: { orderId: order._id.toString() },
      expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour
    });

    // 5. Update order with real payment details
    order.paymentSession = {
      sessionId: stripeSession.id,
      paymentUrl: stripeSession.url,
      expiresAt: new Date(stripeSession.expires_at * 1000)
    };
    await order.save({ session });

    // 6. Update auction status
    auction.status = "completed";
    auction.winningBidder = userId;
    await auction.save({ session });

    // 7. Send email notifications
    await Promise.all([
      auctionEmails.notifyBuyNow(userEmail, auction, order),
      auctionEmails.notifySeller(auction.seller.email, auction, order)
    ]);

    // 8. Create in-app notifications
    const buyer = await User.findById(userId, "username").session(session);

    await Promise.all([
      createNotification(
        req,
        auction.seller._id,
        `${buyer.username} has purchased your auction "${auction.title}" for $${auction.buyNowPrice}.`,
        "SYSTEM",
        userId,
        { model: "Auction", id: auctionId }
      ),
      createNotification(
        req,
        userId,
        `You purchased "${auction.title}". Complete payment here: ${stripeSession.url}`,
        "SYSTEM",
        null,
        { model: "Auction", id: auctionId }
      )
    ]);

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      paymentUrl: stripeSession.url,
      orderId: order._id,
      message: "Auction purchased successfully"
    });

  } catch (error) {
    await session.abortTransaction();
    next(new ApiError(`Purchase failed: ${error.message}`, 500));
  } finally {
    session.endSession();
  }
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
  // Build the base query
  let query = Auction.find();

  // Advanced filtering for various fields
  const queryObj = { ...req.query };

  // Fields to exclude from direct filtering
  const excludedFields = [
    "page",
    "sort",
    "limit",
    "fields",
    "keyword",
    "minPrice",
    "maxPrice",
    "priceRange",
  ];
  excludedFields.forEach((field) => delete queryObj[field]);

  // 1. Keyword search across title and description
  if (req.query.keyword) {
    query = query.find({
      $or: [
        { title: { $regex: req.query.keyword, $options: "i" } },
        { description: { $regex: req.query.keyword, $options: "i" } },
      ],
    });
  }

  // 2. Price range filtering
  if (req.query.minPrice || req.query.maxPrice) {
    const priceFilter = {};
    if (req.query.minPrice) priceFilter.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice) priceFilter.$lte = Number(req.query.maxPrice);
    query = query.find({ currentPrice: priceFilter });
  }
  if (req.query.category) {
    query = query.find({ category: req.query.category });
  }

  // 3. Date filtering
  if (req.query.startAfter) {
    query = query.find({ startDate: { $gte: new Date(req.query.startAfter) } });
  }

  if (req.query.endBefore) {
    query = query.find({ endDate: { $lte: new Date(req.query.endBefore) } });
  }

  // 4. Status filtering
  if (req.query.status) {
    // Allow comma-separated status values for OR filtering
    const statuses = req.query.status.split(",");
    query = query.find({ status: { $in: statuses } });
  }

  // 5. Featured auctions filtering
  if (req.query.featured) {
    query = query.find({ featured: req.query.featured === "true" });
  }

  // 6. Seller filtering
  if (req.query.seller) {
    query = query.find({ seller: req.query.seller });
  }

  // 7. Apply any other direct filters from queryObj
  query = query.find(queryObj);

  // 8. Sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(",").join(" ");
    query = query.sort(sortBy);
  } else {
    // Default sort: featured first, then newest
    query = query.sort("-featured -createdAt");
  }

  // 9. Field limiting
  if (req.query.fields) {
    const fields = req.query.fields.split(",").join(" ");
    query = query.select(fields);
  } else {
    query = query.select("-__v");
  }

  // 10. Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  query = query.skip(skip).limit(limit);

  // 11. Apply necessary population
  query = query
    .populate({ path: "category", select: "name" })
    .populate({ path: "seller", select: "username email profileImage" })
    .populate({
      path: "bids",
      options: { sort: { amount: -1 } },
      populate: { path: "bidder", select: "username email" },
    })
    .populate({ path: "winningBidder", select: "username email" });

  // Execute query
  const auctions = await query;

  // Get total count for pagination
  // Create a count query with the same filters but without pagination
  const countQuery = Auction.find(query.getFilter());
  const totalAuctions = await countQuery.countDocuments();

  // Calculate total pages
  const totalPages = Math.ceil(totalAuctions / limit);

  // Return response
  res.status(200).json({
    status: "success",
    results: auctions.length,
    totalAuctions,
    totalPages,
    currentPage: page,
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
  try {
    const { id } = req.params;

    let auction = await Auction.findById(id).populate("seller", "username _id");
    if (!auction) {
      return res
        .status(404)
        .json({ success: false, message: "Auction not found" });
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
      "title",
      "description",
      "category",
    ];

    const updates = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        if (
          [
            "startPrice",
            "reservePrice",
            "buyNowPrice",
            "minimumBidIncrement",
          ].includes(key)
        ) {
          auction[key] = Number(req.body[key]);
        } else if (key === "endDate") {
          auction[key] = new Date(req.body[key]);
        } else if (key === "category") {
          auction[key] = req.body[key];
          updates[key] = req.body[key];
        } else {
          auction[key] = req.body[key];
        }
        updates[key] = req.body[key];
      }
    });

    // Verify category exists if it's being updated
    if (req.body.category) {
      const categoryExists = await CategoryModel.findById(req.body.category);
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }
    }

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
          `The auction "${auction.title}" has been cancelled by the seller`,
          "SYSTEM",
          null,
          { model: "Auction", id: auction._id }
        );
      }
    } else if (Object.keys(updates).length > 0) {
      const updateItems = [];

      if (updates.title)
        updateItems.push(`title changed to "${updates.title}"`);
      if (updates.category) updateItems.push(`category has been updated`);
      if (updates.endDate)
        updateItems.push(
          `end date changed to ${new Date(updates.endDate).toLocaleString()}`
        );
      if (updates.buyNowPrice)
        updateItems.push(`buy now price changed to $${updates.buyNowPrice}`);
      if (updates.minimumBidIncrement)
        updateItems.push(
          `minimum bid increment changed to $${updates.minimumBidIncrement}`
        );
      if (updates.auctionCover || updates.auctionImages)
        updateItems.push("auction images have been updated");

      const updateMessage = `The auction has been updated: ${updateItems.join(
        ", "
      )}`;

      for (const bidderId of bidders) {
        await createNotification(req, bidderId, updateMessage, "SYSTEM", null, {
          model: "Auction",
          id: auction._id,
        });
      }
    }

    const populatedAuction = await Auction.findById(id)
      .populate("seller", "username _id")
      .populate("category", "name");

    res.status(200).json({ success: true, data: populatedAuction });
  } catch (error) {
    console.error("Error updating auction:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

const deleteAuction = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const auction = await Auction.findById(id);

    if (!auction) {
      return res
        .status(404)
        .json({ success: false, message: "Auction not found" });
    }

    // Check if user is authorized (owner or admin)
    if (
      auction.seller.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this auction",
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
        `An auction you bid on "${auction.title}" has been deleted by the seller`,
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
  } catch (error) {
    console.error("Error deleting auction:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = {
  createAuction,
  placeBid,
  buyNowAuction,
  getAuction,
  getAllAuctions,
  endAuction,
  updateAuction,
  deleteAuction,
};
