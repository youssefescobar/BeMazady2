const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/ChatbotController');

// Start new chat session
router.post('/start', chatbotController.startChat);

// Send message
router.post('/message', chatbotController.sendMessage);

// Get chat history
router.get('/history/:sessionId', chatbotController.getChatHistory);

// Health check
router.get('/health', chatbotController.healthCheck);

module.exports = router;