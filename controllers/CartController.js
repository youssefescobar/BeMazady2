const asyncHandler = require("express-async-handler");
const Cart = require("../models/Cart");
const Item = require("../models/Item");
const ApiError = require("../utils/ApiError");
const Order = require("../models/Order");
const { createCheckoutSession } = require("./PaymentController");
const mongoose = require("mongoose");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const auctionEmails = require("../extra/Emaildb");
const User = require("../models/User");
const { createNotification } = require("./NotificationController");

// Get User Cart - Private
const GetCart = asyncHandler(async (req, res, next) => {
  let cart = await Cart.findOne({ user: req.userId }).populate("items.item");

  if (!cart) {
    cart = new Cart({ user: req.userId, items: [], totalPrice: 0 });
  }

  res.status(200).json({ status: "success", data: cart });
});

// Add Item to Cart - Private
const AddToCart = asyncHandler(async (req, res, next) => {
  const { itemId, quantity } = req.body;

  let cart = await Cart.findOne({ user: req.userId });

  if (!cart) {
    cart = new Cart({ user: req.userId, items: [], totalPrice: 0 });
  }

  const item = await Item.findById(itemId);
  if (!item) return next(new ApiError("Item not found", 404));
  if (item.item_status !== "available") {
    return next(new ApiError("This item is not available for purchase", 400));
  }

  const itemIndex = cart.items.findIndex((cartItem) =>
    cartItem.item.equals(itemId)
  );

  if (itemIndex > -1) {
    cart.items[itemIndex].quantity += quantity;
  } else {
    cart.items.push({ item: itemId, quantity });
  }

  cart.totalPrice = cart.items.reduce(
    (total, cartItem) => total + cartItem.quantity * item.price,
    0
  );

  await cart.save();
  res.status(200).json({ status: "success", data: cart });
});

// Remove Item from Cart - Private
const RemoveFromCart = asyncHandler(async (req, res, next) => {
  const { itemId } = req.body;
  const cart = await Cart.findOne({ user: req.userId });

  if (!cart) return next(new ApiError("Cart not found", 404));

  cart.items = cart.items.filter((cartItem) => !cartItem.item.equals(itemId));

  cart.totalPrice = cart.items.reduce(
    (total, cartItem) => total + cartItem.quantity * cartItem.item.price,
    0
  );

  await cart.save();
  res.status(200).json({ status: "success", data: cart });
});

// Clear Cart - Private
const ClearCart = asyncHandler(async (req, res, next) => {
  await Cart.findOneAndDelete({ user: req.userId });
  res.status(204).json({ message: "Cart cleared successfully" });
});

// Prepare Cart for Checkout - Private
const checkoutCart = asyncHandler(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const cart = await Cart.findOne({ user: req.userId })
      .populate({
        path: "items.item",
        select: "price owner item_status title",
        populate: { path: "owner", select: "_id email username" }
      })
      .session(session);

    if (!cart || !cart.items?.length) {
      await session.abortTransaction();
      return next(new ApiError("Your cart is empty", 400));
    }

    const unavailableItems = cart.items.filter(
      item => !item.item || item.item.item_status !== "available"
    );

    if (unavailableItems.length > 0) {
      await session.abortTransaction();
      return next(new ApiError(
        `${unavailableItems.length} items are no longer available`, 
        400
      ));
    }

    const orderItems = cart.items.map(item => ({
      itemType: "item",
      item: item.item._id,
      quantity: item.quantity,
      priceAtPurchase: item.item.price,
      seller: item.item.owner._id
    }));

    const totalAmount = cart.items.reduce(
      (total, item) => total + item.quantity * item.item.price,
      0
    );

    const [order] = await Order.create([{
      user: req.userId,
      items: orderItems,
      totalAmount,
      status: "pending",
      paymentSession: {
        sessionId: "temp_" + Date.now(),
        paymentUrl: "https://example.com/pending",
        expiresAt: new Date(Date.now() + 3600000)
      }
    }], { session });

    if (!order) {
      await session.abortTransaction();
      return next(new ApiError("Order creation failed", 500));
    }

    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: orderItems.map(item => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Item ${item.item.toString().slice(-4)}`,
            metadata: { itemId: item.item.toString() }
          },
          unit_amount: Math.round(item.priceAtPurchase * 100),
        },
        quantity: item.quantity,
      })),
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/payment/success`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
      customer_email: req.user.email,
      metadata: { orderId: order._id.toString() },
      expires_at: Math.floor(Date.now() / 1000) + 3600
    });

    order.paymentSession = {
      sessionId: stripeSession.id,
      paymentUrl: stripeSession.url,
      expiresAt: new Date(stripeSession.expires_at * 1000)
    };
    await order.save({ session });

    cart.items = [];
    cart.totalPrice = 0;
    await cart.save({ session });

    // 🟨 Notify seller about order
    const buyer = await User.findById(req.userId, "username").session(session);
    const uniqueSellers = [
      ...new Set(cart.items.map(item => item.item.owner._id.toString()))
    ];

    await Promise.all(
      uniqueSellers.map(sellerId => {
        const sellerItems = cart.items.filter(
          i => i.item.owner._id.toString() === sellerId
        );

        return createNotification(
          req,
          sellerId,
          `${buyer.username} placed an order including: ${sellerItems
            .map(i => `"${i.item.title}"`)
            .join(", ")}`,
          "SYSTEM",
          req.userId,
          { model: "Order", id: order._id }
        );
      })
    );

    // 🟨 Notify buyer about successful order placement and payment link
    await createNotification(
      req,
      req.userId,
      `You successfully placed an order. Complete payment here: ${stripeSession.url}`,
      "SYSTEM",
      null,
      { model: "Order", id: order._id }
    );

    // 🟨 Send email to the buyer (using the new `sendOrderEmail` method)
    await auctionEmails.sendOrderEmail(
      req.user.email, // Buyer email
      cart.items.map(item => ({
        title: item.item.title,
        price: item.item.price,
        quantity: item.quantity
      })), // Map the cart items for email
      order // Pass the full order object to access the payment session
    );

    await session.commitTransaction();

    res.json({
      success: true,
      paymentUrl: stripeSession.url,
      orderId: order._id,
      expiresAt: order.paymentSession.expiresAt
    });

  } catch (error) {
    await session.abortTransaction();
    next(new ApiError(
      `Checkout failed: ${error.message}`,
      error.statusCode || 500
    ));
  } finally {
    session.endSession();
  }
});



module.exports = {
  GetCart,
  AddToCart,
  RemoveFromCart,
  ClearCart,
  checkoutCart,
};