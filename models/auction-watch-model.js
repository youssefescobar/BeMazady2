const mongoose = require("mongoose");

// Model for users watching auctions (saved/followed auctions)
const auctionWatchSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    auction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
      required: true,
    },
    notifications: {
      outbid: {
        type: Boolean,
        default: true,
      },
      endingSoon: {
        type: Boolean,
        default: true,
      },
      priceChange: {
        type: Boolean,
        default: true,
      },
    },
  },
  { timestamps: true }
);

// Create a compound index to ensure each user can only watch an auction once
auctionWatchSchema.index({ user: 1, auction: 1 }, { unique: true });

const AuctionWatch = mongoose.model("AuctionWatch", auctionWatchSchema);

module.exports = AuctionWatch;
