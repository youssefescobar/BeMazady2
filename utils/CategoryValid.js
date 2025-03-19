const { check } = require("express-validator");
const validatorr = require("../middlewares/ValidatorMiddle");
const GetCategoryValidator = [
  check("id").isMongoId().withMessage("Invalid ID"),
  validatorr,
];
const UpdateCategoryValidator = [
  check("id").isMongoId().withMessage("Invalid ID"),
  validatorr,
];
const DeleteCategoryValidator = [
  check("id").isMongoId().withMessage("Invalid ID"),
  validatorr,
];
const CreateCategoryValidator = [
  check("name").notEmpty().withMessage("Category name requred"),
  validatorr,
];
module.exports = {
  GetCategoryValidator,
  UpdateCategoryValidator,
  DeleteCategoryValidator,
  CreateCategoryValidator,
};
