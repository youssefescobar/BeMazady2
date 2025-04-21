const mongoose = require("mongoose");

const AuctionSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: false ,default: null},
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startPrice: { type: Number, required: true },
    reservePrice: { type: Number, required: false }, // Optional minimum acceptable price
    buyNowPrice: { type: Number, required: false }, // Optional immediate purchase price
    currentPrice: {
      type: Number,
      default: function () {
        return this.startPrice;
      },
    },
    minimumBidIncrement: { type: Number, default: 1.0 },
    bids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bid" }], // FK to Bid
    winningBidder: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "active", "completed", "cancelled", "failed"],
      default: "pending",
    },
    featured: { type: Boolean, default: false },
    viewCount: { type: Number, default: 0 },
    auctionCover: { type: String, required: true }, // Single cover image
    auctionImages: [{ type: String, required: true }], // Array of images
    description: { type: String, required: true },
    title: { type: String, required: true },
  },
  { timestamps: true }
); // Adds createdAt and updatedAt fields automatically

// Add indexes for frequently queried fields
AuctionSchema.index({ status: 1 });
AuctionSchema.index({ endDate: 1 });
AuctionSchema.index({ seller: 1 });
AuctionSchema.index({ featured: 1 });

// Pre-save hook to ensure currentPrice starts at startPrice if no bids
AuctionSchema.pre("save", function (next) {
  if (this.isNew && !this.currentPrice) {
    this.currentPrice = this.startPrice;
  }
  next();
});

// Virtual for bid count
AuctionSchema.virtual("bidCount").get(function () {
  return this.bids ? this.bids.length : 0;
});

// Virtual for time remaining
AuctionSchema.virtual("timeRemaining").get(function () {
  return this.endDate ? this.endDate - new Date() : 0;
});

// Instance method to check if auction is active
AuctionSchema.methods.isActive = function () {
  const now = new Date();
  return (
    this.status === "active" && now >= this.startDate && now < this.endDate
  );
};

// Instance method to place bid
AuctionSchema.methods.placeBid = function (bidAmount, bidderId) {
  if (!this.isActive()) {
    throw new Error("Cannot bid on inactive auction");
  }

  if (bidAmount <= this.currentPrice) {
    throw new Error("Bid must be higher than current price");
  }

  if (bidAmount < this.currentPrice + this.minimumBidIncrement) {
    throw new Error(`Minimum bid increment is ${this.minimumBidIncrement}`);
  }

  // Update auction
  this.currentPrice = bidAmount;
  this.winningBidder = bidderId;

  // Return updated auction (caller must save)
  return this;
};

module.exports = mongoose.model("Auction", AuctionSchema);
