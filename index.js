const express = require("express");
const dotenv = require("dotenv").config();
const morgan = require("morgan");
const http = require("http"); // For Socket.IO
const jwt = require("jsonwebtoken"); 
const socketIo = require("socket.io");
const mongoose = require("mongoose");

const notificationRoutes = require("./routes/NotificationRoutes");
const messageRoutes = require("./routes/MessageRoutes");
const globalhandel = require("./middlewares/ErrorMiddle");
const ApiError = require("./utils/ApiError");
const dbConnect = require("./config/dbConnection");
const setupSwagger = require("./config/swagger"); 
const CategoryRoute = require("./routes/CategoriesRoutes");
const SubcategoryRoute = require("./routes/SubcategoryRoutes");
const ItemRoute = require("./routes/ItemRoutes");
const AuthRoute = require("./routes/AuthRoute");
const AuctionRoute = require("./routes/AuctionRoute");
const UserRoute = require("./routes/UserRoute");
const recommendationRoutes = require("./routes/RecommendRoute");
const CartRoutes = require("./routes/CartRoute");

const paymentRoutes = require('./routes/PaymentRoute');
const orderRoutes = require('./routes/OrderRoute');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Connect to database
dbConnect();

// Middleware
app.use(express.json());
app.use(morgan("dev"));
let redirectCounts = {};

app.use((req, res, next) => {
  const url = req.originalUrl;
  redirectCounts[url] = (redirectCounts[url] || 0) + 1;
  
  if (redirectCounts[url] > 3) {
    console.error(`Redirect loop detected for ${url}`);
    return res.status(500).json({ error: 'Redirect loop detected' });
  }
  next();
});
app.use((err, req, res, next) => {
  console.error('Redirect Error:', err);
  trackError(err); // Your error tracking service
  next(err);
});
// Set up Swagger
setupSwagger(app); 

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

app.use('/api/payments', paymentRoutes);
app.use('/api/orders', orderRoutes);

app.get('/payment/success', (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const queryString = Object.keys(req.query).length 
    ? `?${new URLSearchParams(req.query).toString()}`
    : '';
  return res.redirect(`${frontendUrl}/payment/success${queryString}`);
});

app.get('/payment/failure', (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const queryParams = new URLSearchParams(req.query).toString();
  return res.redirect(`${frontendUrl}/payment/failure?${queryParams}`);
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
  console.log(`Swagger Docs available at http://localhost:${PORT}/api-docs`);
}); 