require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const faker = require("@faker-js/faker").faker;
const slugify = require("slugify");
const bcrypt = require("bcryptjs");
const Category = require("../models/category");
const Subcategory = require("../models/subcategory");
const Item = require("../models/Item");
const User = require("../models/User");
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

const seedDB = async () => {
  try {
    console.log("🌱 Seeding database...");

    // 🟢 Clear existing data
    await Category.deleteMany({});
    await Subcategory.deleteMany({});
    await Item.deleteMany({});
    await User.deleteMany({});
    // gen users
    let users = new Set();
    while (users.size < 10) {
      users.add({
        first_name: faker.person.firstName(),
        last_name: faker.person.lastName(),
        username: faker.internet.username().toLowerCase(),
        email: faker.internet.email().toLowerCase(),
        password: await bcrypt.hash("password123", 10), // 🔐 Hashed password
        role: faker.helpers.arrayElement(["buyer", "seller", "admin"]),
        address: faker.location.streetAddress(),
        phone_number: faker.number.int({ min: 1000000000, max: 9999999999 }), // 10-digit number
        national_id: faker.number.int({
          min: 10000000000000,
          max: 99999999999999,
        }), // 14-digit number
        user_picture: faker.image.avatar(),
        favorite_list: [],
        password_rest_code: null,
        password_rest_expire: null,
        password_rest_verified: false,
      });
    }
    const userDocs = await User.insertMany([...users]);
    // 🟢 Generate Unique Categories
    let categories = new Set();
    while (categories.size < 5) {
      categories.add(faker.commerce.department());
    }

    const categoryDocs = await Category.insertMany(
      [...categories].map((name) => ({
        name,
        slug: slugify(name, { lower: true }) || faker.string.uuid(), // ✅ FIXED: Prevent null slugs
      }))
    );

    // 🟢 Generate Subcategories
    let subcategories = [];
    for (let i = 0; i < 15; i++) {
      subcategories.push({
        name: faker.commerce.productName(),
        category: faker.helpers.arrayElement(categoryDocs)._id,
      });
    }
    const subcategoryDocs = await Subcategory.insertMany(subcategories);

    // 🟢 Generate Items
    let items = [];
    for (let i = 0; i < 100; i++) {
      const title = faker.commerce.productName();
      items.push({
        title,
        slug: slugify(title, { lower: true }), // ✅ Generate slug
        item_status: faker.helpers.arrayElement([
          "available",
          "sold",
          "pending",
        ]),
        description: faker.commerce.productDescription(),
        price: faker.commerce.price({ min: 10, max: 500 }),
        is_featured: faker.datatype.boolean(),
        item_pictures: [faker.image.url(), faker.image.url()],
        item_cover: faker.image.url(),
        category: faker.helpers.arrayElement(categoryDocs)._id,
        subcategory: faker.helpers.arrayElements(
          subcategoryDocs.map((s) => s._id),
          2
        ),
        ratingsAvg: faker.number.float({ min: 0, max: 5, fractionDigits: 1 }),
      });
    }
    await Item.insertMany(items);
    console.log(`✅ Inserted ${userDocs.length} users`);
    console.log(`✅ Inserted ${categoryDocs.length} categories`);
    console.log(`✅ Inserted ${subcategoryDocs.length} subcategories`);
    console.log(`✅ Inserted ${items.length} items`);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  } finally {
    mongoose.connection.close();
    console.log("🔴 Database connection closed. Seeding completed!");
  }
};

// Run the function
connectDB().then(seedDB);
