const express = require("express");
const dotenv = require("dotenv").config();
const morgan = require("morgan");
const http = require("http"); // For Socket.IO
const jwt = require("jsonwebtoken");
const socketIo = require("socket.io");
const mongoose = require("mongoose");

const compression = require("compression"); // Compression middleware
const rateLimit = require("express-rate-limit"); // Rate limiting middleware
const helmet = require("helmet"); // Helmet middleware

const { initScheduledTasks } = require("./services/scheduledTasks");
const notificationRoutes = require("./routes/NotificationRoutes");
const messageRoutes = require("./routes/MessageRoutes");
const globalhandel = require("./middlewares/ErrorMiddle");
const ApiError = require("./utils/ApiError");
const dbConnect = require("./config/dbConnection");
const CategoryRoute = require("./routes/CategoriesRoutes");
const SubcategoryRoute = require("./routes/SubcategoryRoutes");
const ItemRoute = require("./routes/ItemRoutes");
const AuthRoute = require("./routes/AuthRoute");
const AuctionRoute = require("./routes/AuctionRoute");
const UserRoute = require("./routes/UserRoute");
const recommendationRoutes = require("./routes/RecommendRoute");
const CartRoutes = require("./routes/CartRoute");
const paymentRoutes = require("./routes/paymentRoutes");
const OrderRoutes = require("./routes/OrderRoutes");
// const OrderRoute = require("./routes/OrderRoute");
// const analyticsRoutes = require("./routes/AnalyticsRoutes");

const ReverseAuctionRoute = require("./routes/ReverseAuctionRoute"); // Add this line

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Connect to database
dbConnect();

// Middleware

app.use(compression());
// app.use(helmet());

// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // Max 100 requests per IP
//   message: "Too many requests from this IP, please try again later."
// });
// app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Add this line to handle URL-encoded data

app.use(morgan("dev"));

app.use((err, req, res, next) => {
  console.error("Server Error:", err.message);

  // Optional: if you want to differentiate custom errors
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    status: "error",
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// API Routes
app.use("/api/categories", CategoryRoute);
app.use("/api/subcategories", SubcategoryRoute);
app.use("/api/items", ItemRoute);
app.use("/api/Auth", AuthRoute);
app.use("/api/auctions", AuctionRoute);
app.use("/api/cart", CartRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", UserRoute);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/orders", OrderRoutes);
// app.use('/api/analytics', analyticsRoutes);
app.use("/api/reverseauctions", ReverseAuctionRoute);
// app.use("/api/orders", OrderRoute);

app.get("/", (req, res) => {
  res.send("Api is running ya tohamy");
});
// Handle route errors - ONLY ONE catch-all handler
app.all("*", (req, res, next) => {
  next(new ApiError(`Can't find this route: ${req.originalUrl}`, 400));
});

// Handle express errors
app.use(globalhandel);

// Handle non-express errors
process.on("unhandledRejection", (err) => {
  console.error(`UnhandledRejection error: ${err}`);
  process.exit(1);
});

// Socket.io connection handling
const connectedUsers = {};

io.on("connection", (socket) => {
  console.log("New client connected");

  // User authentication for socket
  socket.on("authenticate", (userId) => {
    console.log(`User ${userId} authenticated on socket`);
    connectedUsers[userId] = socket.id;
    socket.userId = userId;

    // Broadcast user's online status
    socket.broadcast.emit("user_status_changed", {
      userId,
      status: "online",
    });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("Client disconnected");
    if (socket.userId) {
      delete connectedUsers[socket.userId];

      // Broadcast user's offline status
      socket.broadcast.emit("user_status_changed", {
        userId: socket.userId,
        status: "offline",
      });
    }
  });
});

// Make io accessible to our routes
app.set("io", io);
app.set("connectedUsers", connectedUsers);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Online on port: ${PORT}`);
  setTimeout(() => {
    initScheduledTasks(app);
    console.log("Scheduled tasks initialized");
  }, 3000);
});
