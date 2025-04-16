const axios = require("axios")
const ApiError = require("../utils/ApiError") // Assuming ApiError is in utils
const asyncHandler = require("express-async-handler") // Import asyncHandler
const Cart = require("../models/Cart")
const Transaction = require("../models/Transactions") // Changed from Transactions to Transaction
const Order = require("../models/Order")
const User = require("../models/User")
const { retryWithBackoff } = require("../utils/retry")
const { PAYMOB_INTEGRATION_ID, PAYMOB_API_KEY, PAYMOB_IFRAME_ID, PAYMOB_HMAC_SECRET } = process.env // Access environment variable


// Get PayMob authentication token
const getAuthToken = async () => {
    return retryWithBackoff(async () => {
      try {
        // Log the API key (partially masked for security)
        const apiKeyLength = PAYMOB_API_KEY ? PAYMOB_API_KEY.length : 0
        const maskedKey =
          apiKeyLength > 8
            ? `${PAYMOB_API_KEY.substring(0, 4)}...${PAYMOB_API_KEY.substring(apiKeyLength - 4)}`
            : "Invalid or missing API key"
  
        console.log("Attempting to get auth token with API key:", maskedKey)
  
        // Validate API key before making the request
        if (!PAYMOB_API_KEY || PAYMOB_API_KEY.trim() === "") {
          throw new Error("PayMob API key is missing or empty")
        }
  
        // Make the authentication request with proper error handling
        const response = await axios.post(
          "https://accept.paymob.com/api/auth/tokens",
          { api_key: PAYMOB_API_KEY },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 10000, // 10 second timeout
          },
        )
  
        // Validate the response
        if (!response.data || !response.data.token) {
          throw new Error("Invalid response from PayMob: Token missing")
        }
  
        console.log("Auth token received successfully")
        return response.data.token
      } catch (error) {
        // Enhanced error logging
        console.error("Error getting auth token:", error.message)
  
        // Log detailed error information if available
        if (error.response) {
          console.error("Response status:", error.response.status)
          console.error("Response data:", JSON.stringify(error.response.data))
          console.error("Response headers:", JSON.stringify(error.response.headers))
  
          // Provide more specific error messages based on status codes
          if (error.response.status === 400) {
            throw new ApiError(500, "Failed to authenticate with PayMob: Invalid API key or request format")
          } else if (error.response.status === 401) {
            throw new ApiError(500, "Failed to authenticate with PayMob: Unauthorized access")
          } else if (error.response.status === 429) {
            throw new ApiError(500, "Failed to authenticate with PayMob: Rate limit exceeded")
          } else {
            throw new ApiError(500, `Failed to authenticate with PayMob: Server responded with ${error.response.status}`)
          }
        } else if (error.request) {
          // Request was made but no response received
          console.error("No response received:", error.request)
          throw new ApiError(500, "Failed to authenticate with PayMob: No response received")
        } else {
          // Something else caused the error
          throw new ApiError(500, "Failed to authenticate with PayMob: " + error.message)
        }
      }
    })
  }
  

// Create order on PayMob
const createPaymobOrder = async (authToken, amount, items) => {
  try {
    console.log("Creating PayMob order with token:", authToken ? "Token exists" : "Token missing")
    console.log("Order amount:", amount)
    console.log("Order items:", JSON.stringify(items))

    const response = await axios.post("https://accept.paymob.com/api/ecommerce/orders", {
      auth_token: authToken,
      delivery_needed: "false",
      amount_cents: amount * 100, // Convert to cents
      items: items,
    })
    console.log("Create order response status:", response.status)
    return response.data.id
  } catch (error) {
    console.error("Error creating order:", error.message)
    if (error.response) {
      console.error("Response data:", error.response.data)
      console.error("Response status:", error.response.status)
    }
    throw new ApiError(500, "Failed to create order on payment gateway: " + error.message)
  }
}

// Get payment key
const getPaymentKey = async (authToken, orderId, amount, billingData) => {
    try {
      console.log("Getting payment key with token:", authToken ? "Token exists" : "Token missing")
      console.log("Order ID:", orderId)
      console.log("Amount:", amount)
      console.log("Integration ID:", PAYMOB_INTEGRATION_ID)
  
      // Validate integration ID
      if (!PAYMOB_INTEGRATION_ID) {
        throw new Error("PAYMOB_INTEGRATION_ID is missing or empty")
      }
  
      // Validate billing data
      if (!billingData.email || !billingData.first_name || !billingData.last_name || !billingData.phone_number) {
        throw new Error("Required billing data is missing")
      }
  
      const response = await axios.post("https://accept.paymob.com/api/acceptance/payment_keys", {
        auth_token: authToken,
        amount_cents: amount * 100,
        expiration: 3600,
        order_id: orderId,
        billing_data: billingData,
        currency: "EGP",
        integration_id: PAYMOB_INTEGRATION_ID,
      })
  
      console.log("Payment key response status:", response.status)
      return response.data.token
    } catch (error) {
      console.error("Error getting payment key:", error.message)
      if (error.response) {
        console.error("Response data:", JSON.stringify(error.response.data))
        console.error("Response status:", error.response.status)
      }
      throw new ApiError(500, "Failed to generate payment key: " + error.message)
    }
  }

// Initialize payment
exports.initializePayment = asyncHandler(async (req, res, next) => {
  try {
    const { paymentMethod, billingDetails, checkoutId } = req.body;
    const userId = req.userId;
    
    console.log("Initialize payment for user:", userId)
    console.log("Payment method:", paymentMethod)
    console.log("Billing details:", JSON.stringify(billingDetails))

    // Validate billing details
    if (
      !billingDetails ||
      !billingDetails.email ||
      !billingDetails.firstName ||
      !billingDetails.lastName ||
      !billingDetails.phoneNumber
    ) {
      return next(new ApiError("Missing required billing details", 400))
    }

    // Get user cart
    const cart = await Cart.findOne({ user: userId }).populate({
      path: "items.item",
      select: "name price images description seller",
    })

    if (!cart || cart.items.length === 0) {
      return next(new ApiError("Cart is empty", 400))
    }

    console.log("Cart found with items:", cart.items.length)
    console.log("Total price:", cart.totalPrice)

    // Validate PayMob environment variables
    console.log("Checking PayMob environment variables...")
    if (!PAYMOB_API_KEY) {
      console.error("PAYMOB_API_KEY is missing")
      return next(new ApiError("Payment gateway configuration is incomplete: Missing API_KEY", 500))
    }
    if (!PAYMOB_INTEGRATION_ID) {
      console.error("PAYMOB_INTEGRATION_ID is missing")
      return next(new ApiError("Payment gateway configuration is incomplete: Missing INTEGRATION_ID", 500))
    }
    if (!PAYMOB_IFRAME_ID) {
      console.error("PAYMOB_IFRAME_ID is missing")
      return next(new ApiError("Payment gateway configuration is incomplete: Missing IFRAME_ID", 500))
    }
    console.log("PayMob environment variables are present")

    // Prepare items for payment gateway
    console.log("Preparing items for PayMob...")
    const paymentItems = cart.items.map((item) => ({
      name: item.item.name|| "Product Item",
      amount_cents: Math.round(item.item.price * 100),
      description: item.item.description?.substring(0, 100) || "Product Description",
      quantity: item.quantity,
    }))
    console.log("Items prepared:", paymentItems.length)

    // Try to get authentication token directly
    console.log("Attempting to get PayMob auth token...")
    try {
      // Make the authentication request directly
      const authResponse = await axios.post(
        "https://accept.paymob.com/api/auth/tokens",
        { api_key: PAYMOB_API_KEY },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 10000, // 10 second timeout
        },
      )

      console.log("Auth response status:", authResponse.status)

      if (!authResponse.data || !authResponse.data.token) {
        console.error("Invalid response from PayMob: Token missing")
        return next(new ApiError("Failed to authenticate with payment gateway: Invalid response", 500))
      }

      const authToken = authResponse.data.token
      console.log("Auth token received successfully")

      // Create order on PayMob
      console.log("Creating order on PayMob...")
      let orderId
      try {
        const orderResponse = await axios.post("https://accept.paymob.com/api/ecommerce/orders", {
          auth_token: authToken,
          delivery_needed: false,  // Make sure this is a boolean, not a string
          amount_cents: Math.round(cart.totalPrice * 100),  // Ensure proper formatting
          currency: "EGP",  // Make sure currency is included
          merchant_order_id: `ORDER-${Date.now()}`,  // Add a unique merchant order ID
          items: paymentItems
        });

        console.log("Order creation response status:", orderResponse.status)

        if (!orderResponse.data || !orderResponse.data.id) {
          console.error("Invalid response from PayMob: Order ID missing")
          return next(new ApiError("Failed to create order on payment gateway: Invalid response", 500))
        }

        orderId = orderResponse.data.id
        console.log("Order created with ID:", orderId)
      } catch (orderError) {
        console.error("Error creating order on PayMob:", orderError.message);
        if (orderError.response) {
          console.error("Response data:", JSON.stringify(orderError.response.data));
          console.error("Response status:", orderError.response.status);
          console.error("Response headers:", JSON.stringify(orderError.response.headers));
        } else if (orderError.request) {
          console.error("No response received:", orderError.request);
        }
        return next(new ApiError("Failed to create order on payment gateway: " + orderError.message, 500));
      }

      // Get payment key
      console.log("Getting payment key from PayMob...")
      let paymentKey
      try {
        const paymentKeyResponse = await axios.post("https://accept.paymob.com/api/acceptance/payment_keys", {
          auth_token: authToken,
          amount_cents: cart.totalPrice * 100,
          expiration: 3600,
          order_id: orderId,
          billing_data: {
            apartment: billingDetails.apartment || "NA",
            email: billingDetails.email,
            floor: billingDetails.floor || "NA",
            first_name: billingDetails.firstName,
            street: billingDetails.street,
            building: billingDetails.building || "NA",
            phone_number: billingDetails.phoneNumber,
            shipping_method: "NA",
            postal_code: billingDetails.postalCode || "NA",
            city: billingDetails.city,
            country: billingDetails.country,
            last_name: billingDetails.lastName,
            state: billingDetails.state || "NA",
          },
          currency: "EGP",
          integration_id: PAYMOB_INTEGRATION_ID,
        })

        console.log("Payment key response status:", paymentKeyResponse.status)

        if (!paymentKeyResponse.data || !paymentKeyResponse.data.token) {
          console.error("Invalid response from PayMob: Payment key missing")
          return next(new ApiError("Failed to generate payment key: Invalid response", 500))
        }

        paymentKey = paymentKeyResponse.data.token
        console.log("Payment key received successfully")
      } catch (paymentKeyError) {
        console.error("Error getting payment key from PayMob:", paymentKeyError.message)
        if (paymentKeyError.response) {
          console.error("Response data:", JSON.stringify(paymentKeyError.response.data))
          console.error("Response status:", paymentKeyError.response.status)
        }
        return next(new ApiError("Failed to generate payment key: " + paymentKeyError.message, 500))
      }

      // Create transaction record
      console.log("Creating transaction record in database...")
      let transaction
      try {
        transaction = await Transaction.create({
          buyer: userId,
          amount: cart.totalPrice,
          transactionType: "purchase",
          items: cart.items.map((item) => ({
            item: item.item._id,
            quantity: item.quantity,
            price: item.item.price,
          })),
          paymentMethod,
          status: "pending",
          gatewayOrderId: orderId,
          gatewayReference: paymentKey,
        })
        console.log("Transaction created with ID:", transaction._id)
      } catch (dbError) {
        console.error("Error creating transaction record:", dbError.message)
        console.error("Error details:", dbError)
        return next(new ApiError("Failed to create transaction record: " + dbError.message, 500))
      }

      // Return payment information
      console.log("Returning payment information to client...")
      res.status(200).json({
        status: "success",
        data: {
          transactionId: transaction._id,
          paymentKey,
          iframeUrl: `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentKey}`,
        },
      })
    } catch (authError) {
      console.error("Error authenticating with PayMob:", authError.message)
      if (authError.response) {
        console.error("Response data:", JSON.stringify(authError.response.data))
        console.error("Response status:", authError.response.status)
      } else if (authError.request) {
        console.error("No response received from PayMob")
      }
      return next(new ApiError("Failed to authenticate with payment gateway: " + authError.message, 500))
    }
  } catch (error) {
    console.error("Payment initialization failed:", error.message)
    console.error("Error stack:", error.stack)
    return next(new ApiError(500, error.message || "Payment initialization failed"))
  }
})

// Process payment callback
exports.paymentCallback = asyncHandler(async (req, res, next) => {
  try {
    console.log("Payment callback received with query params:", req.query);
    const { hmac, transaction_id, order, success, amount_cents } = req.query;

    // Validate required parameters
    if (!order) {
      console.error("Missing order parameter in callback");
      return res.redirect(`/payment/failure?error=missing_order`);
    }

    // Verify HMAC if payment gateway requires it
    if (hmac && !validateHmac(hmac, req.query)) {
      console.error("Invalid HMAC signature");
      return res.redirect(`/payment/failure?error=invalid_hmac&order=${order}`);
    }

    // Process payment result
    if (success === "true") {
      return await handleSuccessfulPayment(order, transaction_id, res);
    } else {
      return await handleFailedPayment(order, transaction_id, res);
    }
  } catch (error) {
    console.error("Payment callback error:", error);
    return res.redirect(`/payment/failure?error=server_error`);
  }
});

// Helper function for successful payments
async function handleSuccessfulPayment(orderId, transactionId, res) {
  try {
    console.log("Processing successful payment for order:", orderId);
    
    // 1. Find and validate transaction
    const transaction = await Transaction.findOne({ gatewayOrderId: orderId });
    if (!transaction) {
      console.error("Transaction not found for order:", orderId);
      return res.redirect(`/payment/failure?error=transaction_not_found`);
    }

    // 2. Update transaction status
    transaction.status = "completed";
    transaction.gatewayTransactionId = transactionId;
    transaction.completedAt = new Date();
    await transaction.save();

    // 3. Create order record
    const createdOrder = await Order.create({
      user: transaction.buyer,
      items: transaction.items,
      totalAmount: transaction.amount,
      paymentMethod: transaction.paymentMethod,
      paymentStatus: "paid",
      transaction: transaction._id,
    });

    // 4. Clear user's cart (fire-and-forget)
    clearUserCart(transaction.buyer).catch(err => 
      console.error("Error clearing cart:", err)
    );

    // 5. Redirect to success page
    return res.redirect(`/payment/success?transactionId=${transaction._id}`);

  } catch (dbError) {
    console.error("Database error in successful payment:", dbError);
    return res.redirect(`/payment/failure?error=processing_error&order=${orderId}`);
  }
}

// Helper function for failed payments
async function handleFailedPayment(orderId, transactionId, res) {
  try {
    console.log("Processing failed payment for order:", orderId);
    
    await Transaction.findOneAndUpdate(
      { gatewayOrderId: orderId },
      { 
        status: "failed", 
        gatewayTransactionId: transactionId,
        failedAt: new Date() 
      }
    );

    return res.redirect(`/payment/failure?transactionId=${transactionId || "unknown"}`);

  } catch (updateError) {
    console.error("Error updating failed transaction:", updateError);
    return res.redirect(`/payment/failure?error=update_failed&order=${orderId}`);
  }
}

// Utility function to clear user cart
async function clearUserCart(userId) {
  await Cart.findOneAndUpdate(
    { user: userId }, 
    { items: [], totalPrice: 0 }
  );
  console.log("Cart cleared for user:", userId);
}
// Get payment methods
exports.getPaymentMethods = asyncHandler(async (req, res) => {
  try {
    const paymentMethods = [
      { id: "card", name: "Credit/Debit Card", enabled: true },
      { id: "vodafone-cash", name: "Vodafone Cash", enabled: true },
      { id: "orange-money", name: "Orange Money", enabled: true },
      { id: "etisalat-cash", name: "Etisalat Cash", enabled: true },
      { id: "we-pay", name: "WE Pay", enabled: true },
      { id: "fawry", name: "Fawry", enabled: true },
      { id: "meeza", name: "Meeza", enabled: true },
      { id: "cod", name: "Cash on Delivery", enabled: true },
    ]

    res.status(200).json({
      status: "success",
      data: paymentMethods,
    })
  } catch (error) {
    console.error("Error getting payment methods:", error)
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve payment methods",
    })
  }
})

// Get transaction by ID
exports.getTransaction = asyncHandler(async (req, res, next) => {
  try {
    console.log("Getting transaction with ID:", req.params.id)
    const transaction = await Transaction.findById(req.params.id)

    if (!transaction) {
      console.log("Transaction not found with ID:", req.params.id)
      return next(new ApiError("Transaction not found", 404))
    }

    res.status(200).json({
      status: "success",
      data: transaction,
    })
  } catch (error) {
    console.error("Error getting transaction:", error)
    next(new ApiError("Failed to retrieve transaction", 500))
  }
})

// Get user transactions
exports.getUserTransactions = asyncHandler(async (req, res) => {
  try {
    console.log("Getting transactions for user:", req.userId)
    const transactions = await Transaction.find({
      buyer: req.userId,
      transactionType: "purchase",
    }).sort("-timestamp")

    console.log("Found transactions:", transactions.length)

    res.status(200).json({
      status: "success",
      results: transactions.length,
      data: transactions,
    })
  } catch (error) {
    console.error("Error getting user transactions:", error)
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve transactions",
    })
  }
})

// Create COD order directly
exports.createCodOrder = asyncHandler(async (req, res, next) => {
  try {
    const { shippingAddress } = req.body
    const userId = req.userId

    console.log("Creating COD order for user:", userId)
    console.log("Shipping address:", JSON.stringify(shippingAddress))

    // Get user cart
    const cart = await Cart.findOne({ user: userId }).populate({
      path: "items.item",
      select: "name price images description seller",
    })

    if (!cart || cart.items.length === 0) {
      return next(new ApiError("Cart is empty", 400))
    }

    console.log("Cart found with items:", cart.items.length)
    console.log("Total price:", cart.totalPrice)

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
    })

    console.log("Transaction created with ID:", transaction._id)

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
    })

    console.log("Order created with ID:", order._id)

    // Update transaction with order reference
    transaction.relatedOrder = order._id
    await transaction.save()
    console.log("Transaction updated with order reference")

    // Clear cart
    await Cart.findOneAndUpdate({ user: userId }, { items: [], totalPrice: 0 })
    console.log("Cart cleared for user:", userId)

    res.status(201).json({
      status: "success",
      data: order,
    })
  } catch (error) {
    console.error("Error creating COD order:", error)
    next(new ApiError("Failed to create order", 500))
  }
})