// controllers/PaymentController.js
const asyncHandler = require("express-async-handler");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Order = require("../models/Order");
const Auction = require("../models/Auction");
const Item = require("../models/Item");
const User = require("../models/User");
const { createNotification } = require("./NotificationController");
const ApiError = require("../utils/ApiError");

// Create Stripe Checkout Session
const createCheckoutSession = asyncHandler(async (req, res, next) => {
  const { orderId } = req.body;

  const order = await Order.findById(orderId).populate("user");
  if (!order) {
    return next(new ApiError("Order not found", 404));
  }

  if (order.status !== "pending") {
    return next(new ApiError("Order has already been processed", 400));
  }

  const line_items = order.items.map((item) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: `Purchase from ${item.seller.username}`,
        description: `Item type: ${item.itemType}`,
      },
      unit_amount: Math.round(item.priceAtPurchase * 100),
    },
    quantity: item.quantity,
  }));

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items,
    mode: "payment",
    success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/payment/canceled`,
    customer_email: order.user.email,
    metadata: {
      orderId: order._id.toString(),
    },
  });

  // Save payment session to order
  order.paymentSession = {
    sessionId: session.id,
    paymentUrl: session.url,
    expiresAt: new Date(session.expires_at * 1000),
  };
  await order.save();

  res.json({ url: session.url });
});

// Webhook handler for Stripe
const handleWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const order = await Order.findOne({
      "paymentSession.sessionId": session.id,
    });

    if (order && order.status === "pending") {
      order.status = "paid";
      await order.save();

      // Here you can add notifications or other post-payment logic
    }
  }

  res.json({ received: true });
});

module.exports = {
  createCheckoutSession,
  handleWebhook,
};