const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  auction: { type: mongoose.Schema.Types.ObjectId, ref: "Auction", required: true },
  item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
  finalBid: { type: Number, required: true }, 
  platformFee: { type: Number, required: true }, 
  sellerEarnings: { type: Number, required: true },
  status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Transaction", TransactionSchema);
