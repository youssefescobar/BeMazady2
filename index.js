const express = require("express");
const dotenv = require("dotenv").config();
const morgan = require("morgan");
const http = require("http"); // Add this for Socket.IO
const jwt = require("jsonwebtoken"); // Add this for JWT authentication
const socketIo = require('socket.io');
const mongoose = require('mongoose');

const notificationRoutes = require('./routes/NotificationRoutes');
const messageRoutes = require('./routes/MessageRoutes');
const globalhandel = require("./middlewares/ErrorMiddle");
const ApiError = require("./utils/ApiError");
const dbConnect = require("./config/dbConnection");
const CategoryRoute = require("./routes/CategoriesRoutes");
const SubcategoryRoute = require("./routes/SubcategoryRoutes");
const ItemRoute = require("./routes/ItemRoutes");
const AuthRoute = require("./routes/AuthRoute");
const AuctionRoute = require("./routes/AuctionRoute");

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
// Connect to database
dbConnect();

// Middleware
app.use(express.json());
app.use(morgan("dev"));

// API Routes
app.use("/api/categories", CategoryRoute);
app.use("/api/subcategories", SubcategoryRoute);
app.use("/api/items", ItemRoute);
app.use("/api/Auth", AuthRoute);
app.use("/api/auctions", AuctionRoute);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
// Handle route errors
app.all("*", (req, res, next) => {
  next(new ApiError(`Cant find this route:, ${req.originalUrl}`, 400));
});

// Handle express errors
app.use(globalhandel);

// Handle non-express errors
process.on("unhandledRejection", (err) => {
  console.log(`UnhandledRejection error: ${err}`);
  process.exit(1);
});

// Socket.io connection handling
const connectedUsers = {};

io.on('connection', (socket) => {
  console.log('New client connected');
  
  // User authentication for socket
  socket.on('authenticate', (userId) => {
    console.log(`User ${userId} authenticated on socket`);
    connectedUsers[userId] = socket.id;
    socket.userId = userId;
    
    // Broadcast user's online status
    socket.broadcast.emit('user_status_changed', {
      userId: userId,
      status: 'online'
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    if (socket.userId) {
      delete connectedUsers[socket.userId];
      
      // Broadcast user's offline status
      socket.broadcast.emit('user_status_changed', {
        userId: socket.userId,
        status: 'offline'
      });
    }
  });
});
// Make io accessible to our routes
app.set('io', io);
app.set('connectedUsers', connectedUsers);
// Start server (using server.listen instead of app.listen)
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log("Online on port:", PORT);
});