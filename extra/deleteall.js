require("dotenv").config({path: "../.env"});
const mongoose = require("mongoose");
const dbConnect = require("../config/dbConnection"); 
const Item = require("../models/Item");

async function deleteItems() {
  try {
    await dbConnect();

    const result = await Item.deleteMany({});

    console.log(`${result.deletedCount} items successfully deleted.`);
  } catch (error) {
    console.error("Error deleting items:", error);
  } finally {
    mongoose.connection.close();
    console.log("DB connection closed.");
  }
}

deleteItems();