const { check } = require("express-validator");
const validatorr = require("../../middlewares/ValidatorMiddle");
const GetSubcategoryValidator = [
  check("id").isMongoId().withMessage("Invalid ID"),
  validatorr,
];
const UpdateSubcategoryValidator = [
  check("id").isMongoId().withMessage("Invalid ID"),
  validatorr,
];
const DeleteSubcategoryValidator = [
  check("id").isMongoId().withMessage("Invalid ID"),
  validatorr,
];
const CreateSubcategoryValidator = [
  check("name").notEmpty().withMessage("Subcategory name required"),
  check("category")
    .notEmpty()
    .withMessage("Subcategory must belong to a category")
    .isMongoId()
    .withMessage("Invalid ID"),
  validatorr,
];
module.exports = {
  GetSubcategoryValidator,
  UpdateSubcategoryValidator,
  DeleteSubcategoryValidator,
  CreateSubcategoryValidator,
};
