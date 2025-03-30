const express = require("express");
const router = express.Router({ mergeParams: true });
const protect = require("../middlewares/AuthMiddle"); // Ensure correct path
const authorize = require("../middlewares/AuthorizeMiddle"); // Import authorize middleware

const {
  CreateSubcategory,
  GetAllSubcategories,
  GetSubcategory,
  UpdateSubcategory,
  DeleteSubcategory,
} = require("../controllers/SubcategoryController");

const {
  GetSubcategoryValidator,
  UpdateSubcategoryValidator,
  DeleteSubcategoryValidator,
  CreateSubcategoryValidator,
} = require("../utils/Validators/SubcategoryValid");

// Public: Anyone can view subcategories
router.route("/").get(GetAllSubcategories);

// Protected: Only admins can create subcategories
router
  .route("/")
  .post(
    protect,
    authorize("admin", "buyer"),
    CreateSubcategoryValidator,
    CreateSubcategory
  );

// Public: Anyone can get a specific subcategory
router.route("/:id").get(GetSubcategoryValidator, GetSubcategory);

// Protected: Only admins can update or delete subcategories
router
  .route("/:id")
  .put(
    protect,
    authorize("admin"),
    UpdateSubcategoryValidator,
    UpdateSubcategory
  )
  .delete(
    protect,
    authorize("admin"),
    DeleteSubcategoryValidator,
    DeleteSubcategory
  );

module.exports = router;
