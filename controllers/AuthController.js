const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");

// sign up - Public
const Signup = asyncHandler(async (req, res, next) => {
  const {
    first_name,
    last_name,
    username,
    email,
    password,
    phone_number,
    national_id,
  } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    first_name,
    last_name,
    username,
    email,
    password: hashedPassword,
    phone_number,
    national_id,
  });

  const token = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE,
    }
  );
  res.status(201).json({
    success: true,
    data: user,
    token: token,
  });
});

// Login - Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const user = await User.findOne({ email });
  if (!user) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid credentials" });
  }

  // Compare passwords
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid credentials" });
  }

  // Generate JWT token
  const token = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE,
    }
  );

  res.status(200).json({
    success: true,
    token,
    data: { id: user._id, email: user.email, username: user.username },
  });
});

module.exports = { Signup, login };
