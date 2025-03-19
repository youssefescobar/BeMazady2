const express = require("express");
const router = express.Router();
const SubcategoryRoute = require("../routes/SubcategoryRoutes");
router.use("/:categoryId/Subcategories", SubcategoryRoute);
const {
  GetCategoryValidator,
  UpdateCategoryValidator,
  DeleteCategoryValidator,
  CreateCategoryValidator,
} = require("../utils/CategoryValid");

const {
  GetAllCategories,
  CreateCategory,
  GetCategory,
  UpdateCategory,
  DeleteCategory,
} = require("../controllers/CategoryController");

router
  .route("/")
  .get(GetAllCategories)
  .post(CreateCategoryValidator, CreateCategory);
router
  .route("/:id")
  .get(GetCategoryValidator, GetCategory)
  .put(UpdateCategoryValidator, UpdateCategory)
  .delete(DeleteCategoryValidator, DeleteCategory);
module.exports = router;
