const express = require("express");
const router = express.Router({ mergeParams: true });
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
} = require("../utils/SubcategoryValid");

router
  .route("/")
  .post(CreateSubcategoryValidator, CreateSubcategory)
  .get(GetAllSubcategories);

router
  .route("/:id")
  .get(GetSubcategoryValidator, GetSubcategory)
  .delete(DeleteSubcategoryValidator, DeleteSubcategory)
  .put(UpdateSubcategoryValidator, UpdateSubcategory);

module.exports = router;
