const express = require("express");
const router = express.Router();

const protect = require("../middlewares/AuthMiddle");
const authorize = require("../middlewares/AuthorizeMiddle");

const {
  CreateSubcategory,
  GetAllSubcategories,
  GetSubcategory,
  UpdateSubcategory,
  DeleteSubcategory,
  getSubcategoriesByCategory,
} = require("../controllers/SubcategoryController");

const {
  CreateSubcategoryValidator,
  GetSubcategoryValidator,
  UpdateSubcategoryValidator,
  DeleteSubcategoryValidator,
} = require("../utils/Validators/SubcategoryValid");

// 🔓 Public Routes
router.get("/", GetAllSubcategories);
router.get("/:id", GetSubcategoryValidator, GetSubcategory);
router.get("/category/:categoryId", getSubcategoriesByCategory);

// 🔐 Admin-Protected Routes
router.post(
  "/",
  protect,
  authorize("admin"),
  CreateSubcategoryValidator,
  CreateSubcategory
);

router.put(
  "/:id",
  protect,
  authorize("admin"),
  UpdateSubcategoryValidator,
  UpdateSubcategory
);

router.delete(
  "/:id",
  protect,
  authorize("admin"),
  DeleteSubcategoryValidator,
  DeleteSubcategory
);

module.exports = router;
