const User = require("../models/User")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const asyncHandler = require("express-async-handler")
const ApiError = require("../utils/ApiError")
const sendEmail = require("../utils/SendEmail")

// sign up - Public
const Signup = asyncHandler(async (req, res, next) => {
  const { first_name, last_name, username, email, password, phone_number, national_id } = req.body
  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await User.create({
    first_name,
    last_name,
    username,
    email,
    password: hashedPassword,
    phone_number,
    national_id,
  })

  // Use a valid expiration value - "30d" means 30 days
  const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  })
  res.status(201).json({
    success: true,
    data: user,
    token: token,
  })
})

// Login - Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  // Find user by email
  const user = await User.findOne({ email })
  if (!user) {
    return res.status(401).json({ success: false, message: "Invalid credentials" })
  }

  // Compare passwords
  const isMatch = await bcrypt.compare(password, user.password)
  if (!isMatch) {
    return res.status(401).json({ success: false, message: "Invalid credentials" })
  }

  // Generate JWT token with valid expiration
  const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  })

  res.status(200).json({
    success: true,
    token,
    data: { id: user._id, email: user.email, username: user.username },
  })
})

// Forgot paassword
const Forgotpassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email })
  if (!user) {
    return next(new ApiError("No user with given email", 404))
  }

  // Generate a 6-digit numeric reset code
  const resetToken = Math.floor(100000 + Math.random() * 900000).toString()

  // Hash the token for security
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex")

  // Store hashed token in DB
  user.password_rest_code = hashedToken
  user.password_rest_expire = Date.now() + 10 * 60 * 1000 // 10 minutes expiry
  user.password_rest_verified = false

  await user.save()

  const message = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f9f9f9;">
    <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
    <p style="color: #555; font-size: 16px;">Hello <strong>${user.username}</strong>,</p>
    <p style="color: #555; font-size: 16px;">
      We received a request to reset your password. Please use the verification code below to proceed:
    </p>
    <div style="text-align: center; margin: 20px 0;">
      <span style="font-size: 22px; font-weight: bold; color: #fff; background: #007bff; padding: 10px 20px; border-radius: 5px; display: inline-block;">
        ${resetToken}
      </span>
    </div>
    <p style="color: #555; font-size: 16px;">
      This code is valid for <strong>10 minutes</strong>. If you did not request this, please ignore this email.
    </p>
    <hr style="border: 0; border-top: 1px solid #ddd;">
    <p style="color: #777; font-size: 14px; text-align: center;">
      Need help? <a href="mailto:support@bemazady.com" style="color: #007bff; text-decoration: none;">Contact Support</a>
    </p>
    <p style="color: #777; font-size: 14px; text-align: center;">
      &copy; ${new Date().getFullYear()} BeMazady. All rights reserved.
    </p>
  </div>
`

  try {
    await sendEmail({
      email: user.email,
      subject: "Password Reset Request",
      message,
    })

    res.status(200).json({
      success: true,
      message: "Password reset code sent to email",
    })
  } catch (error) {
    // Remove token if email fails
    user.password_rest_code = undefined
    user.password_rest_expire = undefined
    await user.save({ validateBeforeSave: false })

    return next(new ApiError("Email could not be sent", 500))
  }
})

// Verfiy code
const Verifycode = asyncHandler(async (req, res, next) => {
  const hashedRestCode = crypto.createHash("sha256").update(req.body.resetCode).digest("hex")
  const user = await User.findOne({
    password_rest_code: hashedRestCode,
    password_rest_expire: { $gt: Date.now() },
  })
  if (!user) {
    return next(new ApiError("Reset Code invalid or expried"))
  }
  user.password_rest_verified = true
  await user.save()
  res.status(200).json({
    success: true,
  })
})

// rest password
const Resetpassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({
    email: req.body.email,
  })
  if (!user) {
    return next(new ApiError("No user with that email", 404))
  }
  if (!user.password_rest_verified) {
    return next(new ApiError("Rest code is not verfied", 400))
  }
  const hashedPassword = await bcrypt.hash(req.body.newPassword, 10)
  user.password = hashedPassword
  await user.save()

  // Generate JWT token with valid expiration
  const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  })

  // Send success response with token
  res.status(200).json({
    success: true,
    message: "Password reset successfully",
    token,
  })
})
module.exports = { Signup, login, Forgotpassword, Verifycode, Resetpassword }
