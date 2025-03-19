const express = require("express");
const dotenv = require("dotenv").config();
const morgan = require("morgan");
const http = require("http"); // Add this for Socket.IO
const jwt = require("jsonwebtoken"); // Add this for JWT authentication

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

// Start server (using server.listen instead of app.listen)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Online on port:", PORT);
});
