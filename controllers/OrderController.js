const asyncHandler = require("express-async-handler");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Item = require("../models/Item");
const Auction = require("../models/Auction");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createNotification } = require("./NotificationController");

// @desc    Create order from cart
// @route   POST /api/orders/checkout
// @access  Private
const createOrderFromCart = asyncHandler(async (req, res, next) => {
  try {
    // Get user's cart
    const cart = await Cart.findOne({ user: req.user._id }).populate({
      path: "items.item",
      select: "title price owner item_status",
    });

    if (!cart || cart.items.length === 0) {
      return next(new ApiError("Your cart is empty", 400));
    }

    // Validate all items are available
    const unavailableItems = cart.items.filter(
      (item) => item.item.item_status !== "available"
    );

    if (unavailableItems.length > 0) {
      return next(
        new ApiError(
          `Some items in your cart are no longer available: ${unavailableItems
            .map((item) => item.item.title)
            .join(", ")}`,
          400
        )
      );
    }

    // Create order items
    const orderItems = cart.items.map((item) => ({
      item: item.item._id,
      quantity: item.quantity,
      priceAtPurchase: item.item.price,
      seller: item.item.owner,
    }));

    // Calculate total price
    const totalPrice = cart.items.reduce(
      (total, item) => total + item.quantity * item.item.price,
      0
    );

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalPrice * 100, // Stripe uses cents
      currency: "usd",
      metadata: {
        userId: req.user._id.toString(),
        orderType: "cart",
      },
    });

    // Create order
    const order = await Order.create({
      user: req.user._id,
      orderItems,
      totalPrice,
      paymentMethod: "stripe",
      paymentIntentId: paymentIntent.id,
    });

    // Clear the cart
    await Cart.findOneAndDelete({ user: req.user._id });

    res.status(201).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      order,
    });
  } catch (error) {
    return next(new ApiError(error.message, 500));
  }
});

// @desc    Create order for auction win/buy-now
// @route   POST /api/orders/auction/:auctionId
// @access  Private
const createAuctionOrder = asyncHandler(async (req, res, next) => {
  try {
    const { auctionId } = req.params;

    // Get auction details
    const auction = await Auction.findById(auctionId)
      .populate("seller", "username email")
      .populate("winningBidder", "username email");

    if (!auction) {
      return next(new ApiError("Auction not found", 404));
    }

    // Validate user is the winner
    if (auction.winningBidder._id.toString() !== req.user._id.toString()) {
      return next(
        new ApiError("You are not the winner of this auction", 403)
      );
    }

    // Validate auction is completed
    if (auction.status !== "completed") {
      return next(
        new ApiError("This auction is not yet completed", 400)
      );
    }

    // Check if order already exists
    const existingOrder = await Order.findOne({
      auctionOrder: { auction: auctionId },
    });

    if (existingOrder) {
      return next(
        new ApiError("Order already exists for this auction", 400)
      );
    }

    // Get the winning bid
    const winningBid = await Bid.findOne({ auction: auctionId })
      .sort({ amount: -1 })
      .limit(1);

    if (!winningBid) {
      return next(new ApiError("No winning bid found for this auction", 400));
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: winningBid.amount * 100, // Stripe uses cents
      currency: "usd",
      metadata: {
        userId: req.user._id.toString(),
        auctionId: auctionId,
        orderType: "auction",
      },
    });

    // Create order
    const order = await Order.create({
      user: req.user._id,
      auctionOrder: {
        auction: auctionId,
        bid: winningBid._id,
        price: winningBid.amount,
        seller: auction.seller._id,
      },
      totalPrice: winningBid.amount,
      paymentMethod: "stripe",
      paymentIntentId: paymentIntent.id,
      isAuctionOrder: true,
    });

    // Send notification to buyer with payment link
    await createNotification(
      req,
      req.user._id,
      `You won the auction for "${auction.title}". Please complete your payment to claim your item.`,
      "PAYMENT",
      null,
      { model: "Order", id: order._id }
    );

    // Send email with payment link (you would implement this)
    // sendPaymentEmail(req.user.email, paymentIntent.client_secret, order._id);

    res.status(201).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      order,
    });
  } catch (error) {
    return next(new ApiError(error.message, 500));
  }
});

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate("user", "username email")
    .populate("orderItems.item", "title price")
    .populate("orderItems.seller", "username")
    .populate("auctionOrder.auction", "title")
    .populate("auctionOrder.seller", "username");

  if (!order) {
    return next(new ApiError("Order not found", 404));
  }

  // Check if user is owner or admin
  if (
    order.user._id.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    return next(new ApiError("Not authorized to view this order", 403));
  }

  res.status(200).json({
    success: true,
    data: order,
  });
});

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find({ user: req.user._id })
    .populate("orderItems.item", "title price")
    .populate("auctionOrder.auction", "title")
    .sort("-createdAt");

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders,
  });
});

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ApiError("Order not found", 404));
  }

  // Verify payment with Stripe
  const paymentIntent = await stripe.paymentIntents.retrieve(
    order.paymentIntentId
  );

  if (paymentIntent.status !== "succeeded") {
    return next(new ApiError("Payment not completed", 400));
  }

  // Update order
  order.paymentStatus = "paid";
  order.paymentDate = Date.now();
  await order.save();

  // Notify seller(s)
  if (order.isAuctionOrder) {
    // Auction order - single seller
    await createNotification(
      req,
      order.auctionOrder.seller,
      `Your auction item "${order.auctionOrder.auction.title}" has been paid for by ${order.user.username}.`,
      "PAYMENT",
      order.user._id,
      { model: "Order", id: order._id }
    );
  } else {
    // Cart order - multiple sellers possible
    const sellerIds = [...new Set(order.orderItems.map((item) => item.seller))];
    
    for (const sellerId of sellerIds) {
      const sellerItems = order.orderItems.filter((item) =>
        item.seller.equals(sellerId)
      );
      
      await createNotification(
        req,
        sellerId,
        `You have new order(s) from ${order.user.username}: ${sellerItems
          .map((item) => item.item.title)
          .join(", ")}`,
        "ORDER",
        order.user._id,
        { model: "Order", id: order._id }
      );
    }
  }

  res.status(200).json({
    success: true,
    data: order,
  });
});

// @desc    Webhook for Stripe events
// @route   POST /api/orders/webhook
// @access  Public
const webhook = asyncHandler(async (req, res, next) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded":
      const paymentIntent = event.data.object;
      await handlePaymentIntentSucceeded(paymentIntent);
      break;
    case "payment_intent.payment_failed":
      const failedPaymentIntent = event.data.object;
      await handlePaymentIntentFailed(failedPaymentIntent);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Helper function to handle successful payment
// In OrderController.js
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  const order = await Order.findOne({ paymentIntentId: paymentIntent.id })
    .populate('auctionOrder.auction');

  if (order && order.paymentStatus !== "paid") {
    order.paymentStatus = "paid";
    order.paymentDate = Date.now();
    await order.save();

    // Complete auction if it's a buy-now order
    if (order.isAuctionOrder) {
      const auction = await Auction.findById(order.auctionOrder.auction);
      if (auction && auction.status === "active") {
        auction.status = "completed";
        auction.winningBidder = order.user;
        await auction.save();

        // Send notifications
        await createNotification(
          { app: order.app }, // Pass context if needed
          auction.seller,
          `Payment received for auction "${auction.title}"`,
          "PAYMENT",
          order.user,
          { model: "Order", id: order._id }
        );
      }
    }
  }
};

// Helper function to handle failed payment
const handlePaymentIntentFailed = async (paymentIntent) => {
  const order = await Order.findOne({
    paymentIntentId: paymentIntent.id,
  });

  if (order && order.paymentStatus !== "failed") {
    order.paymentStatus = "failed";
    await order.save();

    // Notify user of payment failure
    // This could be done via email or notification
  }
};

module.exports = {
  createOrderFromCart,
  createAuctionOrder,
  getOrderById,
  getMyOrders,
  updateOrderToPaid,
  webhook,
};