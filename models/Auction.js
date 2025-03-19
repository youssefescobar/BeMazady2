const mongoose = require("mongoose");

const AuctionSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true }, // FK to Item
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // FK to User
  startPrice: { type: Number, required: true },
  endPrice: { type: Number, required: false },
  currentPrice: { type: Number, default: 0 },
//   bids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bid" }], // FK to Bid
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ["active", "completed", "cancelled"],
    default: "active",
  },
});

module.exports = mongoose.model("Auction", AuctionSchema);
