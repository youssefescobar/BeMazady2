const mongoose = require("mongoose");

const CategorySchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true, // Trim spaces
    },
    slug: {
      type: String,
      lowercase: true,
      unique: true,
    },
    categoryImage: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const CategoryModel = mongoose.model("Category", CategorySchema);
module.exports = CategoryModel;
