const Order = require("../models/Order")
const Transaction = require("../models/Transactions")
const ApiError = require("../utils/ApiError")
const asyncHandler = require("express-async-handler")

exports.getUserOrders = asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;
    console.log("Getting orders for user:", userId);

    const orders = await Order.find({ user: userId })
      .sort("-createdAt")
      .populate({
        path: "items.product",
        select: "name images price",
      })
      .populate({
        path: "transaction",
        select: "status gatewayTransactionId completedAt" // Only include necessary fields
      });

    console.log("Orders found:", orders.length);
    if (orders.length > 0) {
      console.log("Sample order:", {
        _id: orders[0]._id,
        status: orders[0].paymentStatus,
        itemsCount: orders[0].items.length
      });
    }

    res.status(200).json({
      status: "success",
      results: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
});

// Get specific order
exports.getOrder = asyncHandler(async (req, res, next) => {
  const userId = req.userId

  const order = await Order.findOne({
    _id: req.params.id,
    user: userId,
  })
    .populate("items.product")
    .populate("transaction")

  if (!order) {
    return next(new ApiError("Order not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: order,
  })
})

// Cancel order
exports.cancelOrder = asyncHandler(async (req, res, next) => {
  const userId = req.userId

  const order = await Order.findOne({
    _id: req.params.id,
    user: userId,
  })

  if (!order) {
    return next(new ApiError("Order not found", 404))
  }

  // Check if order can be cancelled
  if (!["pending", "processing"].includes(order.orderStatus)) {
    return next(new ApiError("Cannot cancel order at current status", 400))
  }

  // Update order status
  order.orderStatus = "cancelled"
  await order.save()

  // If payment was made, create refund transaction
  if (order.paymentStatus === "paid") {
    await Transaction.create({
      buyer: userId,
      amount: order.totalAmount,
      transactionType: "purchase",
      paymentMethod: "refund",
      status: "completed",
      relatedOrder: order._id,
    })

    // Update payment status
    order.paymentStatus = "refunded"
    await order.save()
  }

  res.status(200).json({
    status: "success",
    data: order,
  })
})

// Admin: Get all orders
exports.getAllOrders = asyncHandler(async (req, res) => {
  const page = req.query.page * 1 || 1
  const limit = req.query.limit * 1 || 10
  const skip = (page - 1) * limit

  // Build filter object
  const filterObj = {}
  if (req.query.orderStatus) filterObj.orderStatus = req.query.orderStatus
  if (req.query.paymentStatus) filterObj.paymentStatus = req.query.paymentStatus
  if (req.query.paymentMethod) filterObj.paymentMethod = req.query.paymentMethod

  const orders = await Order.find(filterObj)
    .skip(skip)
    .limit(limit)
    .sort("-createdAt")
    .populate("user", "name email phone")
    .populate("items.product", "name images price")
    .populate("transaction")

  const totalOrders = await Order.countDocuments(filterObj)

  res.status(200).json({
    status: "success",
    results: orders.length,
    paginationResult: {
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      limit,
      totalOrders,
    },
    data: orders,
  })
})

// Admin: Update order status
exports.updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { orderStatus } = req.body

  if (!orderStatus) {
    return next(new ApiError("Order status is required", 400))
  }

  const order = await Order.findByIdAndUpdate(req.params.id, { orderStatus }, { new: true, runValidators: true })
    .populate("user", "name email phone")
    .populate("items.product", "name images price")
    .populate("transaction")

  if (!order) {
    return next(new ApiError("Order not found", 404))
  }

  // If order is delivered and payment method is COD, update payment status
  if (orderStatus === "delivered" && order.paymentMethod === "cod") {
    order.paymentStatus = "paid"
    await order.save()

    // Update transaction status
    if (order.transaction) {
      await Transaction.findByIdAndUpdate(order.transaction, { status: "completed" })
    }
  }

  res.status(200).json({
    status: "success",
    data: order,
  })
})
