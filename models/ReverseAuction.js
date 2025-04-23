const mongoose = require("mongoose");

const reverseAuctionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Reverse auction title is required"],
      trim: true,
      minlength: [3, "Too short auction title"],
      maxlength: [100, "Too long auction title"],
    },
    description: {
      type: String,
      required: [true, "Reverse auction description is required"],
      minlength: [20, "Too short auction description"],
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Buyer ID is required"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory", // Change to match the model name
    },
    images: [String],
    startPrice: {
      type: Number,
      required: [true, "Start price is required"],
    },
    status: {
      type: String,
      enum: ["pending", "active", "completed", "cancelled"],
      default: "pending",
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    bids: [
      {
        sellerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected"],
          default: "pending",
        },
      },
    ],
    winningBid: {
      sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      price: {
        type: Number,
      },
      acceptedAt: {
        type: Date,
      },
    },
    requirements: {
      type: String,
      required: [true, "Requirements are necessary for reverse auction"],
    },
    deliveryTime: {
      type: String,
      required: [true, "Expected delivery time is required"],
    },
    location: {
      type: String,
    },
  },
  { timestamps: true }
);

// Virtual fields for time remaining and bid count
reverseAuctionSchema.virtual("timeRemaining").get(function () {
  return Math.max(0, this.endDate - new Date());
});

reverseAuctionSchema.virtual("bidCount").get(function () {
  return this.bids.length;
});

reverseAuctionSchema.virtual("lowestBid").get(function () {
  if (this.bids.length === 0) return null;
  
  return this.bids.reduce((min, bid) => 
    bid.price < min.price ? bid : min
  , this.bids[0]);
});

// Set to return virtuals when converting to JSON
reverseAuctionSchema.set("toJSON", { virtuals: true });
reverseAuctionSchema.set("toObject", { virtuals: true });

// Create a model
const ReverseAuction = mongoose.model("ReverseAuction", reverseAuctionSchema);

module.exports = ReverseAuction;