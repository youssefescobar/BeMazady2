const mongoose = require('mongoose');

// Chat Session Schema
const chatSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  lastActivity: { type: Date, default: Date.now }
});

// Auto-delete sessions after 1 hour of inactivity
chatSessionSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 3600 });

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

module.exports = ChatSession;