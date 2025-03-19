const { check } = require("express-validator");
const validatorr = require("../middlewares/ValidatorMiddle");

const CreateItemValidator = [
  check("title").notEmpty().withMessage("Item title is required"),
  check("item_status")
    .notEmpty()
    .withMessage("Item status is required")
    .isIn(["available", "sold", "pending"])
    .withMessage("Invalid item status"),
  check("description").notEmpty().withMessage("Item description is required"),
  check("price")
    .notEmpty()
    .withMessage("Price is required")
    .isNumeric()
    .withMessage("Price must be a number")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),
  check("is_featured")
    .optional()
    .isBoolean()
    .withMessage("Featured status must be a boolean"),
  check("item_pictures")
    .isArray({ min: 1 })
    .withMessage("At least one item picture is required"),
  check("item_pictures.*")
    .isString()
    .withMessage("Each item picture must be a string (URL)"),
  check("item_cover").notEmpty().withMessage("Item cover image is required"),
  check("category").notEmpty().withMessage("Category is required"),
  check("subcategory")
    .isArray({ min: 1 })
    .withMessage("At least one subcategory is required"),
  check("subcategory.*")
    .notEmpty()
    .withMessage("Each subcategory must be valid"),
  check("ratingsAvg")
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage("Ratings average must be between 0 and 5"),
  validatorr,
];

const UpdateItemValidator = [
  check("title").optional().trim(),
  check("item_status").optional().isIn(["available", "sold", "pending"]),
  check("description").optional().trim(),
  check("price").optional().isFloat({ min: 0 }),
  check("is_featured").optional().isBoolean(),
  check("item_pictures").optional().isArray(),
  check("item_pictures.*").optional().isString(),
  check("item_cover").optional().isString(),
  check("category").optional().isMongoId(),
  check("subcategory").optional().isArray(),
  check("subcategory.*").optional().isMongoId(),
  check("ratingsAvg").optional().isFloat({ min: 0, max: 5 }),
  validatorr,
];

const GetItemValidator = [
  check("id").isMongoId().withMessage("Invalid item ID"),
  validatorr,
];

const DeleteItemValidator = [
  check("id").isMongoId().withMessage("Invalid item ID"),
  validatorr,
];

module.exports = {
  CreateItemValidator,
  UpdateItemValidator,
  GetItemValidator,
  DeleteItemValidator,
};
