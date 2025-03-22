require("dotenv").config(); // Load environment variables
const mongoose = require("mongoose");

const dbConnect = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("⚠️ MONGO_URI is not defined in the .env file");
    }
    
    await mongoose.connect(process.env.MONGO_URI);
    
    console.log("✅ DB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    process.exit(1); // Stop the app if MongoDB connection fails
  }
};

module.exports = dbConnect;