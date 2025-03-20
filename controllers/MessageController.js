// controllers/MessageController.js
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id
    })
    .populate('participants', 'username avatar')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });
    
    res.status(200).json(conversations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    // Verify user is part of this conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: { $in: conversation.participants } },
        { recipient: req.user._id, sender: { $in: conversation.participants } }
      ]
    })
    .sort({ createdAt: 1 })
    .populate('sender', 'username avatar');
    
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

exports.sendMessage = async (req, res) => {
    try {
      const { recipientId, content } = req.body;
      
      if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Message content is required' });
      }
      
      const recipient = await User.findById(recipientId);
      if (!recipient) {
        return res.status(404).json({ error: 'Recipient not found' });
      }
      
      // Create message
      const message = new Message({
        sender: req.user._id,
        recipient: recipientId,
        content
      });
      
      await message.save();
      
      // Find or create conversation
      let conversation = await Conversation.findOne({
        participants: { $all: [req.user._id, recipientId] }
      });
      
      if (!conversation) {
        conversation = new Conversation({
          participants: [req.user._id, recipientId],
          lastMessage: message._id
        });
      } else {
        conversation.lastMessage = message._id;
        conversation.updatedAt = Date.now();
      }
      
      await conversation.save();
      
      // Send message in real-time if recipient is online
      const io = req.app.get('io');
      const connectedUsers = req.app.get('connectedUsers');
      
      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'username avatar');
      
      if (connectedUsers[recipientId]) {
        io.to(connectedUsers[recipientId]).emit('new_message', {
          message: populatedMessage,
          conversationId: conversation._id
        });
      }
      
      // Update conversation list for recipient
      if (connectedUsers[recipientId]) {
        const updatedConversation = await Conversation.findById(conversation._id)
          .populate('participants', 'username avatar')
          .populate('lastMessage');
        
        io.to(connectedUsers[recipientId]).emit('update_conversation', {
          conversation: updatedConversation
        });
      }
      
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ error: 'Failed to send message' });
    }
  };
    

exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    await Message.updateMany(
      { 
        sender: { $ne: req.user._id },
        recipient: req.user._id,
        isRead: false
      },
      { isRead: true }
    );
    
    res.status(200).json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update messages' });
  }
};
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Message.countDocuments({
      recipient: req.user._id,
      isRead: false
    });
    
    res.status(200).json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};