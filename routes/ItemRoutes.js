const express = require("express");
const router = express.Router();
const protect = require("../middlewares/AuthMiddle");
const authorize = require("../middlewares/AuthorizeMiddle");
const upload = require("../middlewares/UploadMiddle");

/**
 * @swagger
 * /items:
 *   get:
 *     summary: Get all items
 *     description: Retrieve a list of all auction items.
 *     responses:
 *       200:
 *         description: List of items
 */

const {
  CreateItem,
  GetAllItems,
  GetItem,
  DeleteItem,
  UpdateItem,
  AddReview,
  EditReview,
  DeleteReview,
  GetReviews,
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

// Review routes (Public for now, you can later add `protect` to restrict them)
router.post("/:id/reviews", protect, AddReview);
router.put("/:id/reviews", protect, EditReview);
router.delete("/:id/reviews", protect, DeleteReview);
router.get("/:id/reviews", GetReviews);

module.exports = router;
