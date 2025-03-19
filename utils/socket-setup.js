// utils/socket-setup.js
const socketIo = require("socket.io");
const jwt = require("jsonwebtoken"); // Add this missing import

const setupSocket = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Socket.io middleware for authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      // Allow connection without authentication for public data
      socket.auth = false;
      return next();
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.auth = true;
      next();
    } catch (error) {
      socket.auth = false;
      next();
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join an auction room to receive updates
    socket.on("joinAuction", (auctionId) => {
      socket.join(`auction_${auctionId}`);
      console.log(`Socket ${socket.id} joined auction_${auctionId}`);
    });

    // Leave an auction room
    socket.on("leaveAuction", (auctionId) => {
      socket.leave(`auction_${auctionId}`);
      console.log(`Socket ${socket.id} left auction_${auctionId}`);
    });

    // Disconnect handler
    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

module.exports = setupSocket;
