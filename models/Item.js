const mongoose = require("mongoose");
const slugify = require("slugify");

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
