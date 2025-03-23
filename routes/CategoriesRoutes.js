const express = require("express");
const router = express.Router();
const protect = require("../middlewares/AuthMiddle");
const authorize = require("../middlewares/AuthorizeMiddle");
const upload = require("../middlewares/UploadMiddle");

const {
  GetAllCategories,
  CreateCategory,
  GetCategory,
  UpdateCategory,
  DeleteCategory,
} = require("../controllers/CategoryController");

const {
  GetCategoryValidator,
  UpdateCategoryValidator,
  DeleteCategoryValidator,
  CreateCategoryValidator,
} = require("../utils/Validators/CategoryValid");

// Public Routes
router.get("/", GetAllCategories);
router.get("/:id", GetCategoryValidator, GetCategory);

// Private Admin Routes
router.post(
  "/",
  protect,
  authorize("admin", "buyer"),
  upload,
  CreateCategoryValidator,
  CreateCategory
);

router.put(
  "/:id",
  protect,
  authorize("admin", "buyer"),
  upload,
  UpdateCategoryValidator,
  UpdateCategory
);

router.delete(
  "/:id",
  protect,
  authorize("admin", "buyer"),
  DeleteCategoryValidator,
  DeleteCategory
);

module.exports = router;
