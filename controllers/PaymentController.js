const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
  timeout: 10000, // 10 seconds
  maxNetworkRetries: 2,
  telemetry: false,
  typescript: true
});

const ApiError = require("../utils/ApiError");
const asyncHandler = require("express-async-handler");
const Cart = require("../models/Cart");
const Transaction = require("../models/Transactions");
const Order = require("../models/Order");
const mongoose = require("mongoose"); // Added missing import
const { FRONTEND_URL } = process.env;
if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
  console.error('FATAL: Invalid Stripe API key configuration');
  process.exit(1);
}
// Initialize payment with Stripe
exports.initializePayment = asyncHandler(async (req, res, next) => {
  try {
    // Verify Stripe key first
    console.log("Stripe key:", process.env.STRIPE_SECRET_KEY?.substring(0, 8) + "...");
    if (!process.env.STRIPE_SECRET_KEY) {
      return next(new ApiError("Payment gateway configuration error", 500));
    }

    const { billingDetails } = req.body;
    const userId = req.userId;
    
    console.log("Initialize payment for user:", userId);
    console.log("Billing details:", JSON.stringify(billingDetails));

    // Validate billing details
    if (!billingDetails || !billingDetails.email || !billingDetails.firstName || 
        !billingDetails.lastName || !billingDetails.phoneNumber) {
      return next(new ApiError("Missing required billing details", 400));
    }

    // Get user cart
    const cart = await Cart.findOne({ user: userId }).populate({
      path: "items.item",
      select: "name price images description seller",
    });

    if (!cart || cart.items.length === 0) {
      return next(new ApiError("Cart is empty", 400));
    }

    console.log("Cart found with items:", cart.items.length);
    console.log("Total price:", cart.totalPrice);

    // Prepare items for Stripe with validation
    const lineItems = cart.items.map((item) => {
      if (!item.item?.price) {
        throw new ApiError("Invalid item price", 400);
      }
      
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.item.name || "Product",
            description: item.item.description?.substring(0, 100) || "",
            images: item.item.images?.[0] ? [item.item.images[0]] : [],
          },
          unit_amount: Math.round(Number(item.item.price) * 100), // Ensure number
        },
        quantity: Number(item.quantity) || 1,
      };
    });

    // Validate BASE_URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    if (!baseUrl.startsWith('http')) {
      throw new Error('BASE_URL must start with http:// or https://');
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${baseUrl}/api/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/api/payments/failure?session_id={CHECKOUT_SESSION_ID}`,
      client_reference_id: userId.toString(),
      customer_email: billingDetails.email,
      metadata: { userId: userId.toString() },
    }, {
      idempotencyKey: `checkout_${userId}_${Date.now()}`
    });

    console.log("Stripe checkout session created:", session.id);

    // Create transaction record
    const transaction = await Transaction.create({
      buyer: userId,
      amount: cart.totalPrice,
      transactionType: "purchase",
      items: cart.items.map((item) => ({
        item: item.item._id,
        quantity: item.quantity,
        price: item.item.price,
      })),
      paymentMethod: "card", // Changed from "stripe" to match your enum
      status: "pending",
      gatewayOrderId: session.id,
      gatewayReference: session.payment_intent || session.id,
    });

    res.status(200).json({
      status: "success",
      data: {
        transactionId: transaction._id,
        checkoutSessionId: session.id,
        paymentUrl: session.url,
      },
    });
  } catch (error) {
    console.error("Payment initialization failed:", {
      message: error.message,
      stack: error.stack,
      ...(error.raw && { rawError: error.raw.message })
    });
    
    next(new ApiError(
      error.message || "Payment initialization failed",
      error.statusCode || 500,
      {
        stripeError: error.type,
        code: error.code,
      }
    ));
  }
});

// Process payment webhook from Stripe
exports.stripeWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleSuccessfulPayment(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handleFailedPayment(event.data.object);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.status(200).json({ received: true });
});

// Handle successful payments
async function handleSuccessfulPayment(session) {
  try {
    console.log("Processing successful payment for session:", session.id);
    
    const userId = session.metadata?.userId || session.client_reference_id;
    if (!userId) {
      console.error("No user ID found in session metadata");
      return;
    }

    const sessionId = session.id;
    
    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();
    
    try {
      // 1. Find and validate transaction
      const transaction = await Transaction.findOne({ gatewayOrderId: sessionId }).session(mongoSession);
      if (!transaction) {
        await mongoSession.abortTransaction();
        console.error("Transaction not found for session:", sessionId);
        return;
      }

      // 2. Update transaction status
      transaction.status = "completed";
      transaction.gatewayTransactionId = session.payment_intent;
      transaction.completedAt = new Date();
      await transaction.save({ session: mongoSession });

      // 3. Create order record
      const orderData = {
        user: transaction.buyer,
        items: transaction.items.map(item => ({
          product: item.item,
          quantity: item.quantity,
          price: item.price,
        })),
        totalAmount: transaction.amount,
        paymentMethod: transaction.paymentMethod,
        paymentStatus: "paid",
        transaction: transaction._id,
      };

      const createdOrder = await Order.create([orderData], { session: mongoSession });
      const savedOrder = createdOrder[0];

      // 4. Update transaction with order reference
      transaction.relatedOrder = savedOrder._id;
      await transaction.save({ session: mongoSession });

      // 5. Clear user's cart
      await Cart.findOneAndUpdate(
        { user: transaction.buyer },
        { $set: { items: [], totalPrice: 0 } },
        { session: mongoSession }
      );

      await mongoSession.commitTransaction();
      console.log("Transaction completed and order created:", savedOrder._id);
    } catch (dbError) {
      await mongoSession.abortTransaction();
      console.error("Database error in successful payment:", dbError);
    } finally {
      mongoSession.endSession();
    }
  } catch (error) {
    console.error("Unexpected error in payment processing:", error);
  }
}

// Handle failed payments
async function handleFailedPayment(paymentIntent) {
  try {
    console.log("Processing failed payment for intent:", paymentIntent.id);
    
    // Find the transaction by payment intent ID
    const transaction = await Transaction.findOneAndUpdate(
      { gatewayReference: paymentIntent.id },
      { 
        status: "failed", 
        failedAt: new Date() 
      },
      { new: true }
    );

    if (!transaction) {
      console.error("Transaction not found for payment intent:", paymentIntent.id);
    } else {
      console.log("Transaction marked as failed:", transaction._id);
    }
  } catch (updateError) {
    console.error("Error updating failed transaction:", updateError);
  }
}
exports.paymentSuccess = asyncHandler(async (req, res) => {
  try {
    const { session_id } = req.query;
    
    // Validate session ID
    if (!session_id || typeof session_id !== 'string') {
      return res.status(400).json({
        status: "error",
        message: "Invalid or missing session ID"
      });
    }

    // Verify the session with Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['payment_intent']
    });

    // Validate payment status
    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        status: "error",
        message: "Payment not completed",
        paymentStatus: session.payment_status
      });
    }

    // Update transaction status in database
    const transaction = await Transaction.findOneAndUpdate(
      { gatewayOrderId: session_id },
      { 
        status: "completed",
        gatewayTransactionId: session.payment_intent?.id,
        completedAt: new Date() 
      },
      { new: true }
    ).populate('relatedOrder');

    if (!transaction) {
      return res.status(404).json({
        status: "error",
        message: "Transaction not found"
      });
    }

    // Return success response with detailed information
    res.status(200).json({
      status: "success",
      data: {
        sessionId: session_id,
        paymentStatus: session.payment_status,
        amountPaid: session.amount_total / 100, // Convert from cents
        currency: session.currency,
        transactionId: transaction._id,
        orderId: transaction.relatedOrder?._id,
        paymentMethod: session.payment_method_types?.[0]
      }
    });
    
  } catch (error) {
    console.error("Payment success processing error:", {
      message: error.message,
      stack: error.stack,
      ...(error.type && { type: error.type })
    });

    res.status(500).json({
      status: "error",
      message: "Error processing payment confirmation",
      ...(process.env.NODE_ENV === 'development' && { 
        detail: error.message 
      })
    });
  }
});
exports.paymentFailure = asyncHandler(async (req, res) => {
  try {
    const { session_id } = req.query;

    // Validate session ID
    if (!session_id || typeof session_id !== 'string') {
      return res.status(400).json({
        status: "error",
        message: "Invalid or missing session ID"
      });
    }

    // Attempt to retrieve session details for more context
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(session_id);
    } catch (stripeError) {
      console.warn("Could not retrieve failed session:", stripeError.message);
    }

    // Update transaction status if exists
    await Transaction.findOneAndUpdate(
      { gatewayOrderId: session_id },
      { 
        status: "failed",
        failedAt: new Date() 
      }
    );

    // Return failure response
    res.status(200).json({
      status: "failed",
      message: "Payment failed or was cancelled",
      data: {
        sessionId: session_id,
        ...(session && {
          paymentStatus: session.payment_status,
          failureReason: session.payment_intent?.last_payment_error?.message
        })
      }
    });
  } catch (error) {
    console.error("Payment failure processing error:", error.message);
    res.status(500).json({
      status: "error",
      message: "Error processing payment failure",
      ...(process.env.NODE_ENV === 'development' && { 
        detail: error.message 
      })
    });
  }
});
// Get payment methods
exports.getPaymentMethods = asyncHandler(async (req, res) => {
  try {
    const paymentMethods = [
      { id: "card", name: "Credit/Debit Card", enabled: true },
      { id: "cod", name: "Cash on Delivery", enabled: true },
    ];

    res.status(200).json({
      status: "success",
      data: paymentMethods,
    });
  } catch (error) {
    console.error("Error getting payment methods:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve payment methods",
    });
  }
});

// Get transaction by ID
exports.getTransaction = asyncHandler(async (req, res, next) => {
  try {
    console.log("Getting transaction with ID:", req.params.id);
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      console.log("Transaction not found with ID:", req.params.id);
      return next(new ApiError("Transaction not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: transaction,
    });
  } catch (error) {
    console.error("Error getting transaction:", error);
    next(new ApiError("Failed to retrieve transaction", 500));
  }
});

// Get user transactions
exports.getUserTransactions = asyncHandler(async (req, res) => {
  try {
    console.log("Getting transactions for user:", req.userId);
    const transactions = await Transaction.find({
      buyer: req.userId,
      transactionType: "purchase",
    }).sort("-timestamp");

    console.log("Found transactions:", transactions.length);

    res.status(200).json({
      status: "success",
      results: transactions.length,
      data: transactions,
    });
  } catch (error) {
    console.error("Error getting user transactions:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve transactions",
    });
  }
});

// Create COD order directly
exports.createCodOrder = asyncHandler(async (req, res, next) => {
  try {
    const { shippingAddress } = req.body;
    const userId = req.userId;

    console.log("Creating COD order for user:", userId);
    console.log("Shipping address:", JSON.stringify(shippingAddress));

    // Get user cart
    const cart = await Cart.findOne({ user: userId }).populate({
      path: "items.item",
      select: "name price images description seller",
    });

    if (!cart || cart.items.length === 0) {
      return next(new ApiError("Cart is empty", 400));
    }

    console.log("Cart found with items:", cart.items.length);
    console.log("Total price:", cart.totalPrice);

    // Create transaction for tracking
    const transaction = await Transaction.create({
      buyer: userId,
      amount: cart.totalPrice,
      transactionType: "purchase",
      items: cart.items.map((item) => ({
        item: item.item._id,
        quantity: item.quantity,
        price: item.item.price,
      })),
      paymentMethod: "cod",
      status: "pending",
    });

    console.log("Transaction created with ID:", transaction._id);

    // Create order
    const order = await Order.create({
      user: userId,
      items: cart.items.map((item) => ({
        product: item.item._id,
        quantity: item.quantity,
        price: item.item.price,
      })),
      totalAmount: cart.totalPrice,
      shippingAddress,
      paymentMethod: "cod",
      paymentStatus: "pending",
      transaction: transaction._id,
    });

    console.log("Order created with ID:", order._id);

    // Update transaction with order reference
    transaction.relatedOrder = order._id;
    await transaction.save();
    console.log("Transaction updated with order reference");

    // Clear cart
    await Cart.findOneAndUpdate({ user: userId }, { items: [], totalPrice: 0 });
    console.log("Cart cleared for user:", userId);

    res.status(201).json({
      status: "success",
      data: order,
    });
  } catch (error) {
    console.error("Error creating COD order:", error);
    next(new ApiError("Failed to create order", 500));
  }
});