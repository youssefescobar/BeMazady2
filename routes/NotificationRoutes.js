const express = require("express");
const router = express.Router();
const NotificationController = require("../controllers/NotificationController");
const protect = require("../middlewares/AuthMiddle"); // Ensure this is correctly named

// Protect routes that require authentication
router.post("/create", protect, NotificationController.createNotificationAPI);
router.get("/", protect, NotificationController.getUserNotifications);
router.put("/read/:id", protect, NotificationController.markAsRead);
router.put("/read-all", protect, NotificationController.markAllAsRead);
router.get("/unread-count", protect, NotificationController.getUnreadCount);

module.exports = router;
