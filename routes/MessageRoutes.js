const express = require("express");
const router = express.Router();
const MessageController = require("../controllers/MessageController");
const protect = require("../middlewares/AuthMiddle"); // Ensure this file exists and works correctly

// Protect all message-related routes
router.get("/conversations", protect, MessageController.getConversations);
router.get(
  "/conversations/:conversationId",
  protect,
  MessageController.getMessages
);
router.post("/conversations", protect, MessageController.createConversation);
router.post("/", protect, MessageController.sendMessage);
router.put(
  "/conversations/read/:conversationId",
  protect,
  MessageController.markAsRead
);
router.delete(
  "/conversations/:conversationId",
  protect,
  MessageController.deleteConversation
);
router.get("/unread-count", protect, MessageController.getUnreadCount);

module.exports = router;
