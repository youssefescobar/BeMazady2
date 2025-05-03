// models/Order.js
const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema({
  itemType: { type: String, enum: ["auction", "item"], required: true },
  item: { type: mongoose.Schema.Types.ObjectId, required: true }, // Can be Auction or Item
  quantity: { type: Number, default: 1 },
  priceAtPurchase: { type: Number, required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
});

const PaymentSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  paymentUrl: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

const OrderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [OrderItemSchema],
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    paymentMethod: { type: String, default: "stripe" },
    paymentSession: PaymentSessionSchema,
    shippingAddress: { type: mongoose.Schema.Types.Mixed }, // Can be structured later
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);