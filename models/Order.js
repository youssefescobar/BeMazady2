const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  priceAtPurchase: {
    type: Number,
    required: true,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "shipped", "delivered", "cancelled"],
    default: "pending",
  },
});

const AuctionOrderSchema = new mongoose.Schema({
  auction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Auction",
    required: true,
  },
  bid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bid",
  },
  price: {
    type: Number,
    required: true,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

const OrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderItems: [OrderItemSchema],
    auctionOrder: AuctionOrderSchema,
    shippingAddress: {
      type: String,
    },
    paymentMethod: {
      type: String,
      enum: ["stripe", "paypal", "bank_transfer"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentIntentId: {
      type: String,
    },
    totalPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    orderStatus: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    isAuctionOrder: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Add indexes for frequently queried fields
OrderSchema.index({ user: 1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ orderStatus: 1 });
OrderSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Order", OrderSchema);