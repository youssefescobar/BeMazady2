const User = require("../models/User");
const Auction = require("../models/Auction");
const bcrypt = require("bcrypt");
const path = require("path");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const ApiFeatures = require("../utils/ApiFeatures");

const getAllUsers = asyncHandler(async (req, res, next) => {
  let query = User.find().select("-password");

  const features = new ApiFeatures(query, req.query)
    .filter("User")
    .sort()
    .limitFields()
    .paginate();

  // Get the total count before pagination
  const totalUsers = await User.countDocuments(features.query.getFilter());

  // Apply pagination and get the users
  const users = await features.query;

  // Calculate total pages
  const limit = req.query.limit * 1 || 10;
  const totalPages = Math.ceil(totalUsers / limit);

  res.status(200).json({
    results: users.length,
    totalUsers,
    totalPages,
    currentPage: req.query.page * 1 || 1,
    data: users,
  });
});

// Get single user by ID
const getUserById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findById(id)
    .select("-password")
    .populate("favorite_list");

  if (!user) {
    return next(new ApiError(`No user found with id: ${id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

// Update user
const updateUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const {
    first_name,
    last_name,
    username,
    email,
    role,
    address,
    phone_number,
    national_id,
  } = req.body;

  // Build update object with only provided fields
  const updateData = {};
  if (first_name) updateData.first_name = first_name;
  if (last_name) updateData.last_name = last_name;
  if (username) updateData.username = username;
  if (email) updateData.email = email;
  if (address) updateData.address = address;
  if (phone_number) updateData.phone_number = phone_number;
  if (national_id) updateData.national_id = national_id;
  if (role) updateData.role = role;

  // Handle Cloudinary image update
  if (
    req.cloudinaryFiles &&
    req.cloudinaryFiles.user_picture &&
    req.cloudinaryFiles.user_picture.length > 0
  ) {
    const newUserPicture = req.cloudinaryFiles.user_picture[0];

    // Optional: delete old Cloudinary image if public_id is stored in DB
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return next(new ApiError(`No user found with id: ${id}`, 404));
    }

    // Optional cleanup logic here (if you store public_id)
    // cloudinary.uploader.destroy(existingUser.user_picture_public_id)

    updateData.user_picture = newUserPicture; // Cloudinary URL
  }

  const updatedUser = await User.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true, runValidators: true }
  ).select("-password");

  if (!updatedUser) {
    return next(new ApiError(`No user found with id: ${id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: updatedUser,
  });
});

// Update password
const updatePassword = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  // Find user with password
  const user = await User.findById(id).select("+password");

  if (!user) {
    return next(new ApiError(`No user found with id: ${id}`, 404));
  }

  // Check if current password is correct
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return next(new ApiError("Current password is incorrect", 401));
  }

  // Hash new password
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  await user.save();

  res.status(200).json({
    success: true,
    message: "Password updated successfully",
  });
});

// Delete user
const deleteUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findById(id);

  if (!user) {
    return next(new ApiError(`No user found with id: ${id}`, 404));
  }

  if (user.user_picture) {
    try {
      // Extract public_id from the Cloudinary URL
      const urlParts = user.user_picture.split("/");
      const filename = urlParts[urlParts.length - 1]; // e.g., my_image.jpg
      const publicId = urlParts
        .slice(urlParts.indexOf("upload") + 1)
        .join("/")
        .replace(/\.[^/.]+$/, ""); // remove extension (.jpg, .png, etc.)

      await cloudinary.uploader.destroy(publicId);
      console.log(`✅ Deleted Cloudinary image: ${publicId}`);
    } catch (err) {
      console.error(`❌ Error deleting image from Cloudinary: ${err.message}`);
    }
  }

  await User.findByIdAndDelete(id);
  res.status(204).send();
});

// Add item to favorites
const addToFavorites = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { itemId } = req.body;

  const user = await User.findById(id);

  if (!user) {
    return next(new ApiError(`No user found with id: ${id}`, 404));
  }

  // Check if item is already in favorites
  if (user.favorite_list.includes(itemId)) {
    return next(new ApiError("Item already in favorites", 400));
  }

  // Add to favorites
  user.favorite_list.push(itemId);
  await user.save();

  res.status(200).json({
    success: true,
    message: "Item added to favorites",
    data: user.favorite_list,
  });
});

// Remove item from favorites
const removeFromFavorites = asyncHandler(async (req, res, next) => {
  const { id, itemId } = req.params;

  const user = await User.findById(id);

  if (!user) {
    return next(new ApiError(`No user found with id: ${id}`, 404));
  }

  // Check if item is in favorites
  if (!user.favorite_list.includes(itemId)) {
    return next(new ApiError("Item not in favorites", 400));
  }

  // Remove from favorites
  user.favorite_list = user.favorite_list.filter(
    (item) => item.toString() !== itemId
  );
  await user.save();

  res.status(200).json({
    success: true,
    message: "Item removed from favorites",
    data: user.favorite_list,
  });
});

// Get user favorites with populated item details
const getUserFavorites = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const user = await User.findById(id)
    .populate("favorite_list")
    .select("favorite_list");

  if (!user) {
    return next(new ApiError(`No user found with id: ${id}`, 404));
  }

  res.status(200).json({
    success: true,
    results: user.favorite_list.length,
    data: user.favorite_list,
  });
});
// update role
const updateUserRole = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { role } = req.body;

  // Check if user exists
  const user = await User.findById(id);
  if (!user) {
    return next(new ApiError(`No user found with id: ${id}`, 404));
  }

  // Valid role check
  const validRoles = ["buyer", "seller"];
  if (!validRoles.includes(role)) {
    return next(
      new ApiError("Invalid role. Role must be either buyer or seller", 400)
    );
  }

  // Update the role
  user.role = role;
  await user.save();

  // Return updated user without password
  const updatedUser = await User.findById(id).select("-password");

  res.status(200).json({
    success: true,
    message: "User role updated successfully",
    data: updatedUser,
  });
});

const getLoggedUser = asyncHandler(async (req, res, next) => {
  req.params.id = req.user._id;
  next();
});

// Get auctions won or bought by the current user
const getWonAuctions = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    // Find auctions where the user is the winning bidder
    const wonAuctions = await Auction.find({
      winningBidder: userId,
      status: "completed",
    })
      .populate("seller", "username _id")
      .populate("category", "name")
      .populate({
        path: "bids",
        match: { bidder: userId },
        options: { sort: { amount: -1 } },
      })
      .sort("-endDate");

    res.status(200).json({
      success: true,
      data: wonAuctions,
    });
  } catch (error) {
    console.error("Error fetching user's won auctions:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  updatePassword,
  deleteUser,
  addToFavorites,
  removeFromFavorites,
  getUserFavorites,
  updateUserRole,
  getLoggedUser,
  getWonAuctions,
};
