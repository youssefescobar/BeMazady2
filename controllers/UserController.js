const User = require("../models/User");
const bcrypt = require("bcrypt");
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
    user_picture,
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
  if (user_picture) updateData.user_picture = user_picture;
  if (role) updateData.role = role;

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

  const deletedUser = await User.findByIdAndDelete(id);

  if (!deletedUser) {
    return next(new ApiError(`No user found with id: ${id}`, 404));
  }

  res.status(204).json({ message: "User deleted successfully" });
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
  const validRoles = ["buyer", "seller", "admin"];
  if (!validRoles.includes(role)) {
    return next(
      new ApiError(
        "Invalid role. Role must be either buyer, seller, or admin",
        400
      )
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

const getLogged = asyncHandler(async (req, res, next) => {
  req.params.id = req.user._id;
  next();
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
};
