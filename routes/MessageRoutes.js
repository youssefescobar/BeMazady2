// routes/MessageRoutes.js
const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/MessageController');
const { authenticateUser } = require('../middlewares/AuthMiddle');

router.get('/conversations', authenticateUser, MessageController.getConversations);
router.get('/conversations/:conversationId', authenticateUser, MessageController.getMessages);
// Create a new conversation
router.post('/conversations', authenticateUser, MessageController.createConversation);
router.post('/', authenticateUser, MessageController.sendMessage);
router.put('/conversations/read/:conversationId', authenticateUser, MessageController.markAsRead);
// Delete a conversation
router.delete('/conversations/:conversationId', authenticateUser, MessageController.deleteConversation);
router.get('/unread-count', authenticateUser, MessageController.getUnreadCount);
module.exports = router;