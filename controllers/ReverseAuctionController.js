
const ReverseAuction = require("../models/ReverseAuction");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const User = require("../models/User");
const Notification = require("../models/Notification");

const Order = require("../models/Order");
const Transaction = require("../models/Transactions");

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
// @desc    Accept a bid on a reverse auction and process to checkout
// @route   POST /api/reverseauctions/:id/accept-bid/:bidId
// @access  Private (Owner only)
exports.acceptBid = asyncHandler(async (req, res, next) => {
  const { id, bidId } = req.params;
  const buyerId = req.user._id;

  // Use a transaction to ensure data integrity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find the reverse auction
    const reverseAuction = await ReverseAuction.findById(id).session(session);

    if (!reverseAuction) {
      await session.abortTransaction();
      return next(new ApiError(`No reverse auction found with ID: ${id}`, 404));
    }

    // Check if the user is the owner
    if (reverseAuction.buyerId.toString() !== buyerId.toString()) {
      await session.abortTransaction();
      return next(
        new ApiError("You are not authorized to accept bids on this reverse auction", 403)
      );
    }

    // Check if auction is active
    if (reverseAuction.status !== "active") {
      await session.abortTransaction();
      return next(new ApiError("This reverse auction is not active", 400));
    }

    // Find the bid
    const bid = reverseAuction.bids.id(bidId);

    if (!bid) {
      await session.abortTransaction();
      return next(new ApiError(`No bid found with ID: ${bidId}`, 404));
    }

    // Update the bid status to accepted
    bid.status = "accepted";

    // Update the auction status to pending_payment
    reverseAuction.status = "pending_payment";
    reverseAuction.winningBid = {
      sellerId: bid.sellerId,
      price: bid.price,
      acceptedAt: Date.now(),
    };

    await reverseAuction.save({ session });

    // Create transaction for tracking
    const transaction = await Transaction.create(
      [{
        buyer: buyerId,
        seller: bid.sellerId,
        amount: bid.price,
        transactionType: "reverse_auction",
        items: [
          {
            reverseAuctionId: reverseAuction._id,
            price: bid.price,
          },
        ],
        paymentMethod: "pending", // Will be updated during checkout
        status: "pending",
        relatedReverseAuction: reverseAuction._id,
      }],
      { session }
    );

    // Create checkout session object
    const checkoutSession = {
      transactionId: transaction[0]._id,
      reverseAuctionId: reverseAuction._id,
      bidId: bidId,
      sellerId: bid.sellerId,
      buyerId: buyerId,
      price: bid.price,
      title: reverseAuction.title,
      checkoutId: require('crypto').randomUUID()
    };

    // Send notification to the seller
    await Notification.create(
      [{
        recipient: bid.sellerId,
        type: "info",
        title: "Your Bid was Accepted",
        message: `Your bid of $${bid.price} on reverse auction "${reverseAuction.title}" was accepted! Awaiting buyer payment.`,
        data: {
          reverseAuctionId: reverseAuction._id,
          transactionId: transaction[0]._id,
          notificationType: "bid_accepted"
        },
      }],
      { session }
    );

    // Send real-time notification via socket.io if available
    const io = req.app.get("io");
    const connectedUsers = req.app.get("connectedUsers");
    
    if (io && connectedUsers[bid.sellerId]) {
      io.to(connectedUsers[bid.sellerId]).emit("new_notification", {
        type: "bid_accepted",
        title: "Bid Accepted",
        message: `Your bid on "${reverseAuction.title}" was accepted! Awaiting buyer payment.`,
        reverseAuctionId: reverseAuction._id,
      });
    }

    await session.commitTransaction();

    res.status(200).json({
      status: "success",
      message: "Bid accepted successfully. Proceed to payment.",
      data: {
        checkoutSession,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    next(new ApiError(`Error accepting bid: ${error.message}`, 500));
  } finally {
    session.endSession();
  }
});

// @desc    Process payment for reverse auction accepted bid
// @route   POST /api/reverseauctions/payment
// @access  Private (Buyer only)
exports.processPayment = asyncHandler(async (req, res, next) => {
  const { 
    transactionId, 
    paymentMethod, 
    billingDetails,
    shippingAddress 
  } = req.body;
  
  const userId = req.user._id;

  // Find transaction
  const transaction = await Transaction.findById(transactionId);
  
  if (!transaction) {
    return next(new ApiError("Transaction not found", 404));
  }
  
  // Verify the transaction belongs to this user
  if (transaction.buyer.toString() !== userId.toString()) {
    return next(new ApiError("Unauthorized access to this transaction", 403));
  }
  
  // Find related reverse auction
  const reverseAuction = await ReverseAuction.findById(transaction.relatedReverseAuction);
  
  if (!reverseAuction) {
    return next(new ApiError("Related reverse auction not found", 404));
  }

  // Handle different payment methods
  if (paymentMethod === "cod") {
    // Process Cash on Delivery
    return processCodPayment(req, res, next, transaction, reverseAuction, shippingAddress);
  } else {
    // Process online payment
    return processOnlinePayment(req, res, next, transaction, reverseAuction, paymentMethod, billingDetails);
  }
});

// Helper function to process COD payment
const processCodPayment = asyncHandler(async (req, res, next, transaction, reverseAuction, shippingAddress) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Update transaction
    transaction.paymentMethod = "cod";
    await transaction.save({ session });

    // Create order for the accepted bid
    const order = await Order.create(
      [{
        user: transaction.buyer,
        seller: transaction.seller,
        items: [{
          product: reverseAuction._id,
          quantity: 1,
          price: transaction.amount,
          type: "reverse_auction"
        }],
        totalAmount: transaction.amount,
        shippingAddress,
        paymentMethod: "cod",
        paymentStatus: "pending",
        transaction: transaction._id,
        orderType: "reverse_auction"
      }],
      { session }
    );

    // Update transaction with order reference
    transaction.relatedOrder = order[0]._id;
    await transaction.save({ session });

    // Update reverse auction status
    reverseAuction.status = "completed";
    reverseAuction.paymentStatus = "pending_cod";
    reverseAuction.orderCreatedAt = Date.now();
    reverseAuction.orderId = order[0]._id;
    await reverseAuction.save({ session });

    // Send notifications
    await sendOrderNotifications(transaction, reverseAuction, "COD", session);

    await session.commitTransaction();

    res.status(201).json({
      status: "success",
      message: "Cash on Delivery order created successfully",
      data: {
        orderId: order[0]._id,
        transactionId: transaction._id,
        paymentMethod: "cod",
      },
    });
  } catch (error) {
    await session.abortTransaction();
    next(new ApiError(`Error processing COD payment: ${error.message}`, 500));
  } finally {
    session.endSession();
  }
});

// Helper function to process online payment
const processOnlinePayment = asyncHandler(async (req, res, next, transaction, reverseAuction, paymentMethod, billingDetails) => {
  // Validate billing details
  if (
    !billingDetails ||
    !billingDetails.email ||
    !billingDetails.firstName ||
    !billingDetails.lastName ||
    !billingDetails.phoneNumber
  ) {
    return next(new ApiError("Missing required billing details", 400));
  }

  try {
    // Update transaction
    transaction.paymentMethod = paymentMethod;
    await transaction.save();

    // Prepare for payment gateway integration
    const { PAYMOB_API_KEY, PAYMOB_INTEGRATION_ID, PAYMOB_IFRAME_ID } = process.env;

    // Validate PayMob environment variables
    if (!PAYMOB_API_KEY || !PAYMOB_INTEGRATION_ID || !PAYMOB_IFRAME_ID) {
      return next(new ApiError("Payment gateway configuration is incomplete", 500));
    }

    // Get authentication token
    const authResponse = await axios.post(
      "https://accept.paymob.com/api/auth/tokens",
      { api_key: PAYMOB_API_KEY },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      }
    );

    if (!authResponse.data || !authResponse.data.token) {
      return next(new ApiError("Failed to authenticate with payment gateway", 500));
    }

    const authToken = authResponse.data.token;

    // Create order on PayMob
    const orderResponse = await axios.post("https://accept.paymob.com/api/ecommerce/orders", {
      auth_token: authToken,
      delivery_needed: false,
      amount_cents: Math.round(transaction.amount * 100),
      currency: "EGP",
      merchant_order_id: `RA-${transaction._id}`,
      items: [
        {
          name: reverseAuction.title || "Reverse Auction",
          amount_cents: Math.round(transaction.amount * 100),
          description: reverseAuction.description?.substring(0, 100) || "Reverse Auction Payment",
          quantity: 1,
        },
      ],
    });

    if (!orderResponse.data || !orderResponse.data.id) {
      return next(new ApiError("Failed to create order on payment gateway", 500));
    }

    const orderId = orderResponse.data.id;

    // Update transaction with gateway order ID
    transaction.gatewayOrderId = orderId;
    await transaction.save();

    // Get payment key
    const paymentKeyResponse = await axios.post("https://accept.paymob.com/api/acceptance/payment_keys", {
      auth_token: authToken,
      amount_cents: Math.round(transaction.amount * 100),
      expiration: 3600,
      order_id: orderId,
      billing_data: {
        apartment: billingDetails.apartment || "NA",
        email: billingDetails.email,
        floor: billingDetails.floor || "NA",
        first_name: billingDetails.firstName,
        street: billingDetails.street || "NA",
        building: billingDetails.building || "NA",
        phone_number: billingDetails.phoneNumber,
        shipping_method: "NA",
        postal_code: billingDetails.postalCode || "NA",
        city: billingDetails.city || "NA",
        country: billingDetails.country || "NA",
        last_name: billingDetails.lastName,
        state: billingDetails.state || "NA",
      },
      currency: "EGP",
      integration_id: PAYMOB_INTEGRATION_ID,
    });

    if (!paymentKeyResponse.data || !paymentKeyResponse.data.token) {
      return next(new ApiError("Failed to generate payment key", 500));
    }

    const paymentKey = paymentKeyResponse.data.token;
    
    // Update transaction with payment key
    transaction.gatewayReference = paymentKey;
    await transaction.save();

    // Return payment information
    res.status(200).json({
      status: "success",
      data: {
        transactionId: transaction._id,
        paymentKey,
        iframeUrl: `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentKey}`,
      },
    });
  } catch (error) {
    next(new ApiError(`Error processing online payment: ${error.message}`, 500));
  }
});

// Helper function to send notifications
const sendOrderNotifications = async (transaction, reverseAuction, paymentMethod, session) => {
  // Notify buyer
  await Notification.create(
    [{
      recipient: transaction.buyer,
      type: "info",
      title: "Order Created",
      message: `Your order for "${reverseAuction.title}" has been created with ${paymentMethod} payment method.`,
      data: {
        reverseAuctionId: reverseAuction._id,
        transactionId: transaction._id,
        notificationType: "order_created"
      },
    }],
    { session }
  );

  // Notify seller
  await Notification.create(
    [{
      recipient: transaction.seller,
      type: "info",
      title: "New Order Received",
      message: `You have received a new order for "${reverseAuction.title}" with ${paymentMethod} payment method.`,
      data: {
        reverseAuctionId: reverseAuction._id,
        transactionId: transaction._id,
        notificationType: "new_order"
      },
    }],
    { session }
  );
};

// @desc    Proceed to checkout for an accepted reverse auction bid
// @route   GET /api/reverseauctions/:id/checkout/:bidId
// @access  Private (Owner only)
exports.prepareCheckout = asyncHandler(async (req, res, next) => {
  const { id, bidId } = req.params;
  const buyerId = req.user._id;

  // Find the reverse auction
  const reverseAuction = await ReverseAuction.findById(id)
    .populate("buyerId", "name email")
    .populate("category", "name")
    .populate({
      path: "bids.sellerId",
      select: "name email profilePicture",
    });

  if (!reverseAuction) {
    return next(new ApiError(`No reverse auction found with ID: ${id}`, 404));
  }

  // Check if the user is the owner
  if (reverseAuction.buyerId._id.toString() !== buyerId.toString()) {
    return next(
      new ApiError("You are not authorized to checkout this reverse auction", 403)
    );
  }

  // Check if auction status is correct
  if (reverseAuction.status !== "pending_payment") {
    return next(new ApiError("This reverse auction is not ready for checkout", 400));
  }

  // Find the accepted bid
  const bid = reverseAuction.bids.id(bidId);

  if (!bid || bid.status !== "accepted") {
    return next(new ApiError(`No accepted bid found with ID: ${bidId}`, 404));
  }

  // Find related transaction
  const transaction = await Transaction.findOne({
    relatedReverseAuction: reverseAuction._id,
    status: "pending"
  });

  if (!transaction) {
    return next(new ApiError("Transaction for this auction not found", 404));
  }

  // Generate checkout data
  const checkoutData = {
    transactionId: transaction._id,
    checkoutId: require('crypto').randomUUID(),
    reverseAuctionId: reverseAuction._id,
    bidId: bidId,
    sellerId: bid.sellerId,
    sellerName: bid.sellerId.name,
    buyerId: buyerId,
    buyerName: reverseAuction.buyerId.name,
    price: bid.price,
    title: reverseAuction.title,
    category: reverseAuction.category ? reverseAuction.category.name : "Not specified",
    description: reverseAuction.description,
    acceptedAt: reverseAuction.winningBid.acceptedAt,
  };

  res.status(200).json({
    status: "success",
    data: checkoutData,
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
// @desc    Handle payment callback for reverse auction payments
// @route   GET /api/reverseauctions/payment/callback
// @access  Public
exports.paymentCallback = asyncHandler(async (req, res, next) => {
  try {
    const orderId = req.query.order || req.query['?order'] || '';
    const transactionId = req.query.transaction_id;
    const success = req.query.success;
    const hmac = req.query.hmac;
    
    if (!orderId) {
      return res.status(400).json({
        status: "error",
        message: "Missing order parameter in callback"
      });
    }

    // Validate HMAC if provided
    if (hmac && !validateHmac(hmac, req.query)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid HMAC signature",
        orderId: orderId
      });
    }

    const isSuccess = success && (success.toLowerCase() === "true");
    return isSuccess 
      ? await handleSuccessfulReverseAuctionPayment(orderId, transactionId, res)
      : await handleFailedReverseAuctionPayment(orderId, transactionId, res);

  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Server error processing payment callback",
      error: error.message
    });
  }
});

// Helper function for successful payments
async function handleSuccessfulReverseAuctionPayment(orderId, transactionId, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Find transaction
    const transaction = await Transaction.findOne({ gatewayOrderId: orderId }).session(session);
    if (!transaction) {
      await session.abortTransaction();
      return res.status(404).json({
        status: "error",
        message: "Transaction not found for this order ID",
        orderId: orderId
      });
    }

    // Update transaction status
    transaction.status = "completed";
    transaction.gatewayTransactionId = transactionId;
    transaction.completedAt = new Date();
    await transaction.save({ session });

    // Find reverse auction
    const reverseAuction = await ReverseAuction.findById(transaction.relatedReverseAuction).session(session);
    if (!reverseAuction) {
      await session.abortTransaction();
      return res.status(404).json({
        status: "error",
        message: "Reverse auction not found",
        orderId: orderId
      });
    }

    // Create order
    const orderData = {
      user: transaction.buyer,
      seller: transaction.seller,
      items: [{
        product: reverseAuction._id,
        quantity: 1,
        price: transaction.amount,
        type: "reverse_auction"
      }],
      totalAmount: transaction.amount,
      paymentMethod: transaction.paymentMethod,
      paymentStatus: "paid",
      transaction: transaction._id,
      orderType: "reverse_auction"
    };

    const createdOrder = await Order.create([orderData], { session });
    const savedOrder = createdOrder[0];

    // Update transaction with order reference
    transaction.relatedOrder = savedOrder._id;
    await transaction.save({ session });

    // Update reverse auction status
    reverseAuction.status = "completed";
    reverseAuction.paymentStatus = "paid";
    reverseAuction.orderCreatedAt = Date.now();
    reverseAuction.orderId = savedOrder._id;
    await reverseAuction.save({ session });

    // Send notifications
    await sendOrderNotifications(transaction, reverseAuction, "online payment", session);

    await session.commitTransaction();

    return res.status(200).json({
      status: "success",
      message: "Payment processed successfully",
      data: {
        transactionId: transaction._id.toString(),
        orderId: savedOrder._id.toString(),
        reverseAuctionId: reverseAuction._id.toString(),
        paymentStatus: "completed",
        amount: transaction.amount
      }
    });

  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      status: "error",
      message: "Error processing successful payment",
      error: error.message,
      orderId: orderId
    });
  } finally {
    session.endSession();
  }
}

// Helper function for failed payments
async function handleFailedReverseAuctionPayment(orderId, transactionId, res) {
  try {
    const transaction = await Transaction.findOneAndUpdate(
      { gatewayOrderId: orderId },
      { 
        status: "failed", 
        gatewayTransactionId: transactionId,
        failedAt: new Date() 
      },
      { new: true }
    );

    // Find related reverse auction
    if (transaction && transaction.relatedReverseAuction) {
      await ReverseAuction.findByIdAndUpdate(
        transaction.relatedReverseAuction,
        { paymentStatus: "failed" }
      );
    }

    return res.status(200).json({
      status: "failed",
      message: "Payment failed",
      data: {
        transactionId: transaction ? transaction._id.toString() : null,
        gatewayOrderId: orderId,
        gatewayTransactionId: transactionId || "unknown",
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Error updating failed transaction",
      error: error.message,
      orderId: orderId
    });
  }
}

// HMAC validation function
function validateHmac(receivedHmac, params) {
  try {
    const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET;
    
    if (!PAYMOB_HMAC_SECRET) {
      console.warn("HMAC validation skipped: Missing HMAC secret");
      return true; // Skip validation if secret is not configured
    }
    
    // Create a copy of params without the hmac
    const paramsToValidate = { ...params };
    delete paramsToValidate.hmac;
    
    // Sort keys alphabetically
    const sortedKeys = Object.keys(paramsToValidate).sort();
    
    // Create string of key=value pairs
    const concatenatedString = sortedKeys
      .map(key => `${key}=${paramsToValidate[key]}`)
      .join('&');
    
    // Generate HMAC
    const crypto = require('crypto');
    const calculatedHmac = crypto
      .createHmac('sha512', PAYMOB_HMAC_SECRET)
      .update(concatenatedString)
      .digest('hex');
    
    return calculatedHmac === receivedHmac;
  } catch (error) {
    console.error("HMAC validation error:", error);
    return false;
  }
}

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