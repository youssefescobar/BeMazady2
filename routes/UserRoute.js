const express = require("express");
const router = express.Router();
const userController = require("../controllers/UserController");
const {
  GetAllUsersValidator,
  GetUserByIdValidator,
  UpdateUserValidator,
  UpdatePasswordValidator,
  DeleteUserValidator,
  AddToFavoritesValidator,
  RemoveFromFavoritesValidator,
  GetUserFavoritesValidator,
  UpdateUserRoleValidator,
} = require("../utils/Validators/UserValid");

router.get("/", GetAllUsersValidator, userController.getAllUsers);

// Get user by ID
router.get("/:id", GetUserByIdValidator, userController.getUserById);

// Update user
router.put("/:id", UpdateUserValidator, userController.updateUser);

// Delete user
router.delete("/:id", DeleteUserValidator, userController.deleteUser);

// Password update
router.patch("/:id/password", UpdatePasswordValidator, userController.updatePassword);

// Role update
router.patch("/:id/role", UpdateUserRoleValidator, userController.updateUserRole);

// Favorites management
router.get("/:id/favorites", GetUserFavoritesValidator, userController.getUserFavorites);
router.post("/:id/favorites", AddToFavoritesValidator, userController.addToFavorites);
router.delete("/:id/favorites/:itemId", RemoveFromFavoritesValidator, userController.removeFromFavorites);

module.exports = router;