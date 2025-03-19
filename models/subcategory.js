const mongoose = require("mongoose");
const SubCatSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trime: true,
      unique: [true, "Subcategory must be unique"],
    },
    slug: {
      type: String,
      lowercase: true,
    },
    category: {
      type: mongoose.Schema.ObjectId,
      ref: "Category",
      required: [true, "Subcategory must belong to a parent category"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SubCategory", SubCatSchema);
