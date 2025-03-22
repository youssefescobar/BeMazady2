const express = require("express");
const router = express.Router();
const protect = require("../middlewares/AuthMiddle"); // Ensure correct path
const SubcategoryRoute = require("../routes/SubcategoryRoutes");
const authorize = require("../middlewares/AuthorizeMiddle");
// Nested route for subcategories
router.use("/:categoryId/Subcategories", SubcategoryRoute);

const {
  GetCategoryValidator,
  UpdateCategoryValidator,
  DeleteCategoryValidator,
  CreateCategoryValidator,
} = require("../utils/Validators/CategoryValid");

const {
  GetAllCategories,
  CreateCategory,
  GetCategory,
  UpdateCategory,
  DeleteCategory,
} = require("../controllers/CategoryController");

// Public route: Anyone can get categories
router.route("/").get(GetAllCategories);

// Protected routes: Only authenticated users can create, update, and delete categories
router
  .route("/")
  .post(protect, authorize("admin"), CreateCategoryValidator, CreateCategory);

router
  .route("/:id")
  .get(GetCategoryValidator, GetCategory) // Public
  .put(protect, authorize("admin"), UpdateCategoryValidator, UpdateCategory) // Protected
  .delete(protect, authorize("admin"), DeleteCategoryValidator, DeleteCategory); // Protected

module.exports = router;
