const express = require("express");
const router = express.Router();
const protect = require("../middlewares/AuthMiddle");
const authorize = require("../middlewares/AuthorizeMiddle");
const upload = require("../middlewares/UploadMiddle");

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

// Public routes
router.get("/", GetAllItems);
router.get("/:id", GetItemValidator, GetItem);

// Protected routes (Require authentication)
router.post("/", protect, upload, CreateItemValidator, CreateItem);
router.put(
  "/:id",
  protect,
  authorize("admin"),
  upload,
  UpdateItemValidator,
  UpdateItem
);
router.delete(
  "/:id",
  protect,
  authorize("admin", "seller", "buyer"),
  DeleteItemValidator,
  DeleteItem
);

module.exports = router;
