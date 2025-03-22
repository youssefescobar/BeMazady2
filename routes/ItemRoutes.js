const express = require("express");
const router = express.Router();
const protect = require("../middlewares/AuthMiddle"); // Ensure correct path
const authorize = require("../middlewares/AuthorizeMiddle"); // Import authorize middleware

const {
  CreateItem,
  GetAllItems,
  GetItem,
  DeleteItem,
  UpdateItem,
} = require("../controllers/ItemController");

const {
  CreateItemValidator,
  UpdateItemValidator,
  GetItemValidator,
  DeleteItemValidator,
} = require("../utils/Validators/ItemValid");

// Public: Anyone can view items
router.get("/", GetAllItems);
router.get("/:id", GetItemValidator, GetItem);

// Protected: Only logged-in users can create items
router.post("/", protect, CreateItemValidator, CreateItem);

// Protected: Only admins can update or delete items
router.put(
  "/:id",
  protect,
  authorize("admin"),
  UpdateItemValidator,
  UpdateItem
);
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  DeleteItemValidator,
  DeleteItem
);

module.exports = router;
