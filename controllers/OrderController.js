const asyncHandler = require("express-async-handler");
const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = asyncHandler(async (req, res, next) => {
  const { items, totalAmount, shippingAddress } = req.body;

  // Validation
  if (!items || !totalAmount) {
    return next(new ApiError("Items and total amount are required", 400));
  }

  const order = await Order.create({
    user: req.userId,
    items: items.map(item => ({
      ...item,
      priceAtPurchase: item.priceAtPurchase || item.price // Fallback
    })),
    totalAmount,
    shippingAddress,
    status: "pending"
  });

  res.status(201).json({
    success: true,
    data: order
  });
});

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private (Owner/Admin)
const getOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate("user", "name email")
    .populate("items.item", "name price");

  if (!order) {
    return next(new ApiError("Order not found", 404));
  }

  // Authorization - owner or admin
  if (order.user._id.toString() !== req.userId.toString() && req.user.role !== "admin") {
    return next(new ApiError("Not authorized to view this order", 403));
  }

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (Admin)
const updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ["pending", "paid", "shipped", "delivered", "cancelled"];

  if (!validStatuses.includes(status)) {
    return next(new ApiError("Invalid status", 400));
  }

  const order = await Order.findById(req.params.id);
  if (!order) return next(new ApiError("Order not found", 404));

  // Business logic checks
  if (status === "paid" && order.status !== "pending") {
    return next(new ApiError("Only pending orders can be marked as paid", 400));
  }

  order.status = status;
  await order.save();

  // TODO: Add notifications here

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Get user's orders
// @route   GET /api/orders/my-orders
// @access  Private
const getMyOrders = asyncHandler(async (req, res, next) => {
  const { status } = req.query;

  const filter = { user: req.userId };
  if (status) {
    filter.status = status;
  }

  const orders = await Order.find(filter)
    .sort("-createdAt")
    .populate("items.item", "name price image");

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});

// @desc    Get all orders (Admin)
// @route   GET /api/orders
// @access  Private/Admin
const getAllOrders = asyncHandler(async (req, res, next) => {
  const { status } = req.query;

  const filter = {};
  if (status) {
    filter.status = status;
  }

  const orders = await Order.find(filter)
    .populate("user", "name email")
    .sort("-createdAt");

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});

// @desc    Process refund
// @route   POST /api/orders/:id/refund
// @access  Private/Admin
const processRefund = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new ApiError("Order not found", 404));

  if (order.status !== "paid") {
    return next(new ApiError("Only paid orders can be refunded", 400));
  }

  // Create Stripe refund
  try {
    const refund = await stripe.refunds.create({
      payment_intent: order.paymentIntentId,
      reason: "requested_by_customer"
    });

    order.status = "refunded";
    await order.save();

    res.status(200).json({
      success: true,
      data: { order, refund }
    });
  } catch (err) {
    return next(new ApiError("Refund failed: " + err.message, 500));
  }
});

module.exports = {
  createOrder,
  getOrder,
  updateOrderStatus,
  getMyOrders,
  getAllOrders,
  processRefund
};