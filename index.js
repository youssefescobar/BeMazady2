const express = require("express");
const dotenv = require("dotenv").config();
const morgan = require("morgan");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

// Import routes and middleware
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
const analyticsRoutes = require("./routes/AnalyticsRoutes");
const ChatbotRoutes = require("./routes/ChatbotRoutes")
// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:5173", "https://bemzady.netlify.app"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Connect to database
dbConnect();

// Middleware
app.use(compression());
// app.use(helmet());

// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   message: "Too many requests from this IP, please try again later."
// });
// app.use(limiter);

app.use("/api/payment/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enhanced CORS configuration
const allowedOrigins = ["http://localhost:5173", "https://be-mzady.vercel.app"];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.some(
          (allowedOrigin) =>
            origin === allowedOrigin ||
            origin.startsWith(allowedOrigin) ||
            origin.endsWith(".vercel.app")
        )
      ) {
        return callback(null, true);
      }

      const msg = `CORS policy doesn't allow access from: ${origin}`;
      return callback(new Error(msg), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Handle preflight requests
app.options("*", cors());

app.use(morgan("dev"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server Error:", err.message);
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
app.use("/api/analytics", analyticsRoutes);
app.use('/api/chatbot', ChatbotRoutes);

app.get("/", (req, res) => {
  res.send("Api is running");
});

// Handle route errors
app.all("*", (req, res, next) => {
  next(new ApiError(`Can't find this route: ${req.originalUrl}`, 400));
});

// Global error handler
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

  socket.on("authenticate", (userId) => {
    console.log(`User ${userId} authenticated on socket`);
    connectedUsers[userId] = socket.id;
    socket.userId = userId;
    socket.broadcast.emit("user_status_changed", {
      userId,
      status: "online",
    });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    if (socket.userId) {
      delete connectedUsers[socket.userId];
      socket.broadcast.emit("user_status_changed", {
        userId: socket.userId,
        status: "offline",
      });
    }
  });
});

// Make io accessible to routes
app.set("io", io);
app.set("connectedUsers", connectedUsers);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port: ${PORT}`);
  setTimeout(() => {
    initScheduledTasks(app);
    console.log("Scheduled tasks initialized");
  }, 3000);
});
