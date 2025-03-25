const mongoose = require("mongoose");
const slugify = require("slugify");

const ReviewSchema = new mongoose.Schema(
  {
    user: {
      id: { type: mongoose.Schema.ObjectId, ref: "User", required: true },
      username: { type: String, required: true }, // Store the actual username
    },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false } // Prevent auto-generating an _id for subdocuments
);

const ItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Title is required"], trim: true },

    item_status: {
      type: String,
      required: true,
      enum: ["available", "sold", "pending"],
      default: "available",
    },

    description: {
      type: String,
      required: [true, "Item description is required"],
    },

    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must be a positive number"],
      trim: true,
    },

    is_featured: {
      type: Boolean,
      default: false,
    },

    item_pictures: [{ type: String, default: [] }],

    item_cover: { type: String, default: "" },

    category: {
      type: mongoose.Schema.ObjectId,
      ref: "Category",
      required: true,
    },

    subcategory: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "SubCategory",
        required: true,
      },
    ],

    ratingsAvg: {
      type: Number,
      min: 0,
      max: 5,
    },
    reviews: [ReviewSchema],
    slug: {
      type: String,
      required: true,
      lowercase: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Item", ItemSchema);
