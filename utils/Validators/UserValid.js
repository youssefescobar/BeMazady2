const { check } = require("express-validator");
const validatorr = require("../../middlewares/ValidatorMiddle");
const UserModel = require("../../models/User");
const ItemModel = require("../../models/Item");

// Get All Users Validator
const GetAllUsersValidator = [
  check("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  check("limit")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Limit must be a positive integer"),
  validatorr,
];

// Get User By ID Validator
const GetUserByIdValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid user ID")
    .custom(async (userId, { req }) => {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error(`No user found with ID: ${userId}`);
      }
    }),
  validatorr,
];

// Update User Validator
const UpdateUserValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid user ID")
    .custom(async (userId, { req }) => {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error(`No user found with ID: ${userId}`);
      }
    }),
  check("first_name")
    .optional()
    .isString()
    .withMessage("First name must be a string")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),
  check("last_name")
    .optional()
    .isString()
    .withMessage("Last name must be a string")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),
  check("username")
    .optional()
    .isString()
    .withMessage("Username must be a string")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .custom(async (username, { req }) => {
      const existingUser = await UserModel.findOne({
        username,
        _id: { $ne: req.params.id },
      });
      if (existingUser) {
        throw new Error("Username already in use");
      }
    }),
  check("email")
    .optional()
    .isEmail()
    .withMessage("Invalid email format")
    .custom(async (email, { req }) => {
      const existingUser = await UserModel.findOne({
        email,
        _id: { $ne: req.params.id },
      });
      if (existingUser) {
        throw new Error("Email already in use");
      }
    }),
  check("role")
    .optional()
    .isIn(["user", "admin", "seller"])
    .withMessage("Role must be either user, admin, or seller"),
  check("address")
    .optional()
    .isString()
    .withMessage("Address must be a string"),
  check("phone_number")
    .optional()
    .isMobilePhone()
    .withMessage("Invalid phone number format")
    .custom(async (phone_number, { req }) => {
      const existingUser = await UserModel.findOne({
        phone_number,
        _id: { $ne: req.params.id },
      });
      if (existingUser) {
        throw new Error("Phone number already in use");
      }
    }),
  check("national_id")
    .optional()
    .isString()
    .withMessage("National ID must be a string")
    .custom(async (national_id, { req }) => {
      const existingUser = await UserModel.findOne({
        national_id,
        _id: { $ne: req.params.id },
      });
      if (existingUser) {
        throw new Error("National ID already in use");
      }
    }),
  check("user_picture")
    .optional()
    .isURL()
    .withMessage("User picture must be a valid URL"),
  validatorr,
];

// Update Password Validator
const UpdatePasswordValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid user ID")
    .custom(async (userId, { req }) => {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error(`No user found with ID: ${userId}`);
      }
    }),
  check("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  check("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  validatorr,
];

// Delete User Validator
const DeleteUserValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid user ID")
    .custom(async (userId, { req }) => {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error(`No user found with ID: ${userId}`);
      }
    }),
  validatorr,
];

// Add to Favorites Validator
const AddToFavoritesValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid user ID")
    .custom(async (userId, { req }) => {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error(`No user found with ID: ${userId}`);
      }
    }),
  check("itemId")
    .isMongoId()
    .withMessage("Invalid item ID")
    .custom(async (itemId) => {
      const item = await ItemModel.findById(itemId);
      if (!item) {
        throw new Error(`No item found with ID: ${itemId}`);
      }
    }),
  validatorr,
];

// Remove from Favorites Validator
const RemoveFromFavoritesValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid user ID")
    .custom(async (userId, { req }) => {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error(`No user found with ID: ${userId}`);
      }
    }),
  check("itemId").isMongoId().withMessage("Invalid item ID"),
  validatorr,
];

// Get User Favorites Validator
const GetUserFavoritesValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid user ID")
    .custom(async (userId, { req }) => {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error(`No user found with ID: ${userId}`);
      }
    }),
  validatorr,
];

// Update User Role Validator
const UpdateUserRoleValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid user ID")
    .custom(async (userId, { req }) => {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error(`No user found with ID: ${userId}`);
      }
    }),
  check("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["buyer", "seller", "admin"])
    .withMessage("Role must be either buyer, seller, or admin"),
  validatorr,
];

module.exports = {
  GetAllUsersValidator,
  GetUserByIdValidator,
  UpdateUserValidator,
  UpdatePasswordValidator,
  DeleteUserValidator,
  AddToFavoritesValidator,
  RemoveFromFavoritesValidator,
  GetUserFavoritesValidator,
  UpdateUserRoleValidator,
};
