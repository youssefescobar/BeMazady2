require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");


const models = {
  category: require("../models/category"),
  subcategory: require("../models/subcategory"),
  item: require("../models/Item"),
  user: require("../models/User"),
};
// Connect to MongoDB
const connectDB = async () => {
  try {
    console.log("🔵 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error);
    process.exit(1);
  }
};
const clearCollection = async (collectionName) => {
    try {
      const model = models[collectionName.toLowerCase()];
      if (!model) {
        console.log(`❌ Collection '${collectionName}' not found.`);
        process.exit(1);
      }
  
      await model.deleteMany({});
      console.log(`✅ Cleared all documents from '${collectionName}' collection.`);
    } catch (error) {
      console.error(`❌ Error clearing collection '${collectionName}':`, error);
    }
  };
  
  // Execute script
  const run = async () => {
    await connectDB();
  
    const collectionName = process.argv[2]; // Get collection name from command-line arguments
    if (!collectionName) {
      console.log("❌ Please specify a collection name.");
      process.exit(1);
    }
  
    await clearCollection(collectionName);
    mongoose.connection.close();
  };
  
  run();
// how to use ya 7uda - node emptydb.js (user,category,subcategory,item) <- te5tar enta wa7da 