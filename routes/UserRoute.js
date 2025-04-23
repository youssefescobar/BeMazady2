const express = require("express");
const router = express.Router();
const protect = require("../middlewares/AuthMiddle");
const authorize = require("../middlewares/AuthorizeMiddle");
const userController = require("../controllers/UserController");
const uploadMiddleware = require("../middlewares/UploadMiddle");
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

// Admin-only: Get all users
router.get(
  "/",
  protect,
  authorize("admin"),
  GetAllUsersValidator,
  userController.getAllUsers
);

router.get(
  "/Myprofile",
  protect,
  userController.getLoggedUser,
  userController.getUserById
);
// User & Admin: Get user by ID (users can only see their own info)
router.get("/:id", protect, GetUserByIdValidator, userController.getUserById);

// User & Admin: Update user (users can update their own info, admins can update any user)
router.put(
  "/:id",
  protect,
  uploadMiddleware,
  UpdateUserValidator,
  userController.updateUser
);

// Admin-only: Delete user
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  DeleteUserValidator,
  userController.deleteUser
);

// User & Admin: Password update (users can update their own password)
router.patch(
  "/:id/password",
  protect,
  UpdatePasswordValidator,
  userController.updatePassword
);

// Admin-only: Update user role
router.patch(
  "/:id/role",
  protect,
  authorize("seller", "admin", "buyer"),
  UpdateUserRoleValidator,
  userController.updateUserRole
);

// User & Admin: Favorites management (users can manage their own favorites)
router.get(
  "/:id/favorites",
  protect,
  GetUserFavoritesValidator,
  userController.getUserFavorites
);
router.post(
  "/:id/favorites",
  protect,
  AddToFavoritesValidator,
  userController.addToFavorites
);
router.delete(
  "/:id/favorites/:itemId",
  protect,
  RemoveFromFavoritesValidator,
  userController.removeFromFavorites
);

module.exports = router;
