const asyncHandler = require("express-async-handler")
const Cart = require("../models/Cart")
const Item = require("../models/Item")
const ApiError = require("../utils/ApiError")

// Get User Cart - Private
const GetCart = asyncHandler(async (req, res, next) => {
  let cart = await Cart.findOne({ user: req.userId }).populate("items.item")

  if (!cart) {
    cart = new Cart({ user: req.userId, items: [], totalPrice: 0 })
  }

  res.status(200).json({ status: "success", data: cart })
})

// Add Item to Cart - Private
const AddToCart = asyncHandler(async (req, res, next) => {
  const { itemId, quantity } = req.body

  let cart = await Cart.findOne({ user: req.userId })

  if (!cart) {
    cart = new Cart({ user: req.userId, items: [], totalPrice: 0 })
  }

  const item = await Item.findById(itemId)
  if (!item) return next(new ApiError("Item not found", 404))
  if (item.item_status !== "available") {
    return next(new ApiError("This item is not available for purchase", 400))
  }

  const itemIndex = cart.items.findIndex((cartItem) => cartItem.item.equals(itemId))

  if (itemIndex > -1) {
    cart.items[itemIndex].quantity += quantity
  } else {
    cart.items.push({ item: itemId, quantity })
  }

  cart.totalPrice = cart.items.reduce((total, cartItem) => total + cartItem.quantity * item.price, 0)

  await cart.save()
  res.status(200).json({ status: "success", data: cart })
})

// Remove Item from Cart - Private
const RemoveFromCart = asyncHandler(async (req, res, next) => {
  const { itemId } = req.body
  const cart = await Cart.findOne({ user: req.userId })

  if (!cart) return next(new ApiError("Cart not found", 404))

  cart.items = cart.items.filter((cartItem) => !cartItem.item.equals(itemId))

  cart.totalPrice = cart.items.reduce((total, cartItem) => total + cartItem.quantity * cartItem.item.price, 0)

  await cart.save()
  res.status(200).json({ status: "success", data: cart })
})

// Clear Cart - Private
const ClearCart = asyncHandler(async (req, res, next) => {
  await Cart.findOneAndDelete({ user: req.userId })
  res.status(204).json({ message: "Cart cleared successfully" })
})

// Prepare Cart for Checkout - Private
const PrepareCheckout = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.userId }).populate({
    path: "items.item",
    select: "name price images description seller",
  });

  if (!cart || cart.items.length === 0) {
    return next(new ApiError("Cart is empty", 400));
  }

  // Calculate final prices and prepare checkout data
  const checkoutData = {
    items: cart.items.map((item) => ({
      id: item.item._id,
      name: item.item.name,
      price: item.item.price,
      quantity: item.quantity,
      subtotal: item.item.price * item.quantity,
      seller: item.item.seller,
    })),
    totalPrice: cart.totalPrice,
    itemCount: cart.items.length,
    totalItems: cart.items.reduce((total, item) => total + item.quantity, 0),
  };

  // Generate a checkoutId if you want to track this checkout session
  const checkoutId = require('crypto').randomUUID();
  
  // You could store this in the session or a temporary database collection
  // await CheckoutSession.create({ _id: checkoutId, userId: req.userId, ...checkoutData });
  
  res.status(200).json({ 
    status: "success", 
    data: {
      ...checkoutData,
      checkoutId 
    }
  });
});

module.exports = {
  GetCart,
  AddToCart,
  RemoveFromCart,
  ClearCart,
  PrepareCheckout, // Make sure this is exported
}
