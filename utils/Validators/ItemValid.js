const { check } = require("express-validator");
const validatorr = require("../../middlewares/ValidatorMiddle");
const CategoryModel = require("../../models/category");
const SubcategoryModel = require("../../models/subcategory");
const CreateItemValidator = [
  check("title").notEmpty().withMessage("Item title is required"),

check("item_status")
  .optional()
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
  .withMessage("Must be a boolean"),


  // Validate item_pictures (accepts both file uploads & URLs)
  check("item_pictures").custom((value, { req }) => {
    if (!req.files?.item_pictures && (!value || value.length === 0)) {
      throw new Error("At least one item picture is required");
    }
    return true;
  }),

  // Validate item_cover (accepts both file uploads & URLs)
  check("item_cover").custom((value, { req }) => {
    if (!req.files?.item_cover && !value) {
      throw new Error("Item cover image is required");
    }
    return true;
  }),

  check("category")
    .notEmpty()
    .withMessage("Category is required")
    .isMongoId()
    .withMessage("Invalid category ID")
    .custom(async (CategoryId) => {
      const category = await CategoryModel.findById(CategoryId);
      if (!category) {
        throw new Error(`No Category with id: ${CategoryId}`);
      }
    }),

  check("subcategory").custom((value, { req }) => {
    const subcats = req.body.subcategory;
    if (!subcats || (Array.isArray(subcats) && subcats.length === 0)) {
      throw new Error("At least one subcategory is required");
    }
    return true;
  }),

  check("subcategory.*")
    .isMongoId()
    .withMessage("Invalid subcategory ID")
    .custom(async (SubcategoryId) => {
      const subcategory = await SubcategoryModel.findById(SubcategoryId);
      if (!subcategory) {
        throw new Error(`No Subcategory with id: ${SubcategoryId}`);
      }
    }),

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

  check("item_pictures")
    .optional()
    .custom((value, { req }) => {
      if (!req.files?.item_pictures && value && !Array.isArray(value)) {
        throw new Error("Invalid format for item pictures");
      }
      return true;
    }),

  check("item_cover")
    .optional()
    .custom((value, { req }) => {
      if (!req.files?.item_cover && value && typeof value !== "string") {
        throw new Error("Invalid format for item cover");
      }
      return true;
    }),

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
