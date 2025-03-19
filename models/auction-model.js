const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    bidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const auctionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
      default: [],
    },
    category: {
      type: String,
      required: true,
      enum: ["art", "vehicles", "electronics", "collectibles", "real-estate", "other"],
    },
    startingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    currentPrice: {
      type: Number,
      default: function() {
        return this.startingPrice;
      },
    },
    minBidIncrement: {
      type: Number,
      required: true,
      min: 1,
      default: 10,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "ended", "cancelled"],
      default: "pending",
    },
    bids: [bidSchema],
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    featuredAuction: {
      type: Boolean,
      default: false,
    },
    views: {
      type: Number,
      default: 0,
    },
    watchCount: {
      type: Number,
      default: 0,
    }
  },
  { timestamps: true }
);

// Virtual for active status
auctionSchema.virtual("isActive").get(function() {
  const now = new Date();
  return now >= this.startTime && now <= this.endTime && this.status === "active";
});

// Virtual for time remaining
auctionSchema.virtual("timeRemaining").get(function() {
  const now = new Date();
  if (now > this.endTime) return 0;
  return Math.max(0, this.endTime - now);
});

// Create index for better performance on queries
auctionSchema.index({ status: 1, endTime: -1 });
auctionSchema.index({ seller: 1 });
auctionSchema.index({ category: 1 });

// Middleware to auto-update status based on time
auctionSchema.pre("save", function(next) {
  const now = new Date();
  
  // Auto-update status based on time
  if (this.startTime <= now && this.endTime > now && this.status === "pending") {
    this.status = "active";
  } else if (this.endTime <= now && (this.status === "pending" || this.status === "active")) {
    this.status = "ended";
    
    // If auction ended with bids, set winner
    if (this.bids.length > 0) {
      // Get highest bid
      const highestBid = this.bids.sort((a, b) => b.amount - a.amount)[0];
      this.winner = highestBid.bidder;
    }
  }
  
  next();
});

const Auction = mongoose.model("Auction", auctionSchema);

module.exports = Auction;
