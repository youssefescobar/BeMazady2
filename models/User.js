const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      default: "buyer",
    },
    address: { type: String },
    phone_number: { type: Number, unique: true, required: true },
    national_id: { type: Number, unique: true, required: true },
    user_picture: { type: String, default: "" },
    favorite_list: [{ type: mongoose.Schema.Types.ObjectId, ref: "Item" }], // References Item collection
    password_rest_code: String,
    password_rest_expire: Date,
    password_rest_verified: Boolean,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", UserSchema);
