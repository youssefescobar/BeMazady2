const { v4: uuidv4 } = require('uuid');
const ChatSession = require('../models/Chatbot');
const chatbotService = require('../services/chatbotService');

class ChatbotController {
  
  // Start new chat session
  async startChat(req, res) {
    try {
      const sessionId = uuidv4();
      
      const newSession = new ChatSession({
        sessionId: sessionId,
        messages: [],
        lastActivity: new Date()
      });
      
      await newSession.save();
      
      res.json({ 
        sessionId: sessionId,
        message: 'Chat session started successfully'
      });
    } catch (error) {
      console.error('Error starting chat session:', error);
      res.status(500).json({ error: 'Failed to start chat session' });
    }
  }

  // Send message
  async sendMessage(req, res) {
    try {
      const { sessionId, message } = req.body;
      
      if (!sessionId || !message) {
        return res.status(400).json({ error: 'sessionId and message are required' });
      }
      
      // Find or create session
      let session = await ChatSession.findOne({ sessionId });
      if (!session) {
        session = new ChatSession({
          sessionId: sessionId,
          messages: [],
          lastActivity: new Date()
        });
      }
      
      // Process message using chatbot service
      const result = await chatbotService.processMessage(session, message);
      
      // Save updated session
      await result.session.save();
      
      res.json({
        response: result.response,
        sessionId: sessionId,
        faqUsed: result.faqUsed
      });
      
    } catch (error) {
      console.error('Error processing message:', error);
      res.status(500).json({ error: 'Failed to process message' });
    }
  }

  // Get chat history
  async getChatHistory(req, res) {
    try {
      const { sessionId } = req.params;
      
      const session = await ChatSession.findOne({ sessionId });
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      res.json({
        sessionId: sessionId,
        messages: session.messages,
        lastActivity: session.lastActivity
      });
    } catch (error) {
      console.error('Error fetching chat history:', error);
      res.status(500).json({ error: 'Failed to fetch chat history' });
    }
  }

  // Health check
  async healthCheck(req, res) {
    try {
      res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        message: 'FAQ Chatbot API is running'
      });
    } catch (error) {
      console.error('Error in health check:', error);
      res.status(500).json({ error: 'Health check failed' });
    }
  }
}

module.exports = new ChatbotController();