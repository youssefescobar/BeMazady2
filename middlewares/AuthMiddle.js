const jwt = require("jsonwebtoken");
const User = require("../models/User");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");

const protect = asyncHandler(async (req, res, next) => {
  let token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return next(new ApiError("You are not logged in", 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.userId).select("-password");

    if (!req.user) {
      return next(new ApiError("No user with that ID", 401));
    }

    req.userId = req.user._id; // Keep this from Version 1
    next();
  } catch (error) {
    return next(new ApiError("Not authorized, invalid token", 401));
  }
});

module.exports = protect;
