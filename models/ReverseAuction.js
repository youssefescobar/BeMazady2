const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bidSchema = new Schema({
  sellerId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const winningBidSchema = new Schema({
  sellerId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  acceptedAt: {
    type: Date,
    default: Date.now,
  },
});

const reverseAuctionSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "A reverse auction must have a title"],
      trim: true,
      maxlength: [100, "Title cannot be more than 100 characters"],
    },
    description: {
      type: String,
      required: [true, "A reverse auction must have a description"],
      trim: true,
    },
    buyerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "A reverse auction must belong to a buyer"],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "A reverse auction must belong to a category"],
    },
    subcategory: {
      type: Schema.Types.ObjectId,
      ref: "Subcategory",
    },
    startPrice: {
      type: Number,
      required: [true, "A reverse auction must have a starting price"],
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: [true, "A reverse auction must have an end date"],
    },
    requirements: {
      type: String,
      required: [true, "A reverse auction must have requirements"],
    },
    deliveryTime: {
      type: String,
      required: [true, "A reverse auction must have a delivery time"],
    },
    location: {
      type: String,
    },
    status: {
      type: String,
      enum: ["active", "pending_payment", "completed", "cancelled"],
      default: "active",
    },
    paymentStatus: {
      type: String,
      enum: ["none", "pending", "pending_cod", "paid", "failed"],
      default: "none",
    },
    bids: [bidSchema],
    winningBid: {
      type: winningBidSchema,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
    orderCreatedAt: {
      type: Date,
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for efficient queries
reverseAuctionSchema.index({ buyerId: 1, createdAt: -1 });
reverseAuctionSchema.index({ status: 1, endDate: 1 });
reverseAuctionSchema.index({ "bids.sellerId": 1 });

// Middleware to populate references
reverseAuctionSchema.pre(/^find/, function (next) {
  this.populate({
    path: "bids.sellerId",
    select: "name email profilePicture",
  });
  next();
});

module.exports = mongoose.model("ReverseAuction", reverseAuctionSchema);