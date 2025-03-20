// routes/MessageRoutes.js
const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/MessageController');
const { authenticateUser } = require('../middlewares/AuthMiddle');

router.get('/conversations', authenticateUser, MessageController.getConversations);
router.get('/conversations/:conversationId', authenticateUser, MessageController.getMessages);
router.post('/', authenticateUser, MessageController.sendMessage);
router.put('/conversations/:conversationId/read', authenticateUser, MessageController.markAsRead);
router.get('/unread-count', authenticateUser, MessageController.getUnreadCount);
module.exports = router;