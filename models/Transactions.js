const mongoose = require("mongoose")

const TransactionSchema = new mongoose.Schema({
  // Keep existing fields for auction transactions
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  auction: { type: mongoose.Schema.Types.ObjectId, ref: "Auction" },
  item: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
  finalBid: { type: Number },
  platformFee: { type: Number },
  sellerEarnings: { type: Number },

  // Add new fields for regular e-commerce transactions
  transactionType: {
    type: String,
    enum: ["auction", "purchase"],
    required: true,
    default: "purchase",
  },
  amount: { type: Number, required: true },
  items: [
    {
      item: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
      quantity: { type: Number },
      price: { type: Number },
    },
  ],
  paymentMethod: {
    type: String,
    enum: ["card", "vodafone-cash", "orange-money", "etisalat-cash", "we-pay", "fawry", "meeza", "cod", "refund"],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "refunded"],
    default: "pending",
  },
  gatewayOrderId: String,
  gatewayTransactionId: String,
  gatewayReference: String,
  relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  metadata: { type: Object },
  timestamp: { type: Date, default: Date.now },
})

// Add indexes for better query performance
TransactionSchema.index({ buyer: 1, timestamp: -1 })
TransactionSchema.index({ seller: 1, timestamp: -1 })
TransactionSchema.index({ status: 1 })
TransactionSchema.index({ transactionType: 1 })

module.exports = mongoose.model("Transaction", TransactionSchema)
