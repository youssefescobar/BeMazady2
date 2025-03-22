// controllers/MessageController.js
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const NotificationController = require('../controllers/NotificationController');

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
    const { recipientId, content, referenceId } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    
    // Create message with optional referenceId
    const message = new Message({
      sender: req.user._id,
      recipient: recipientId,
      content,
      referenceId // Include the referenceId if provided
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
    
    if (connectedUsers && connectedUsers[recipientId]) {
      io.to(connectedUsers[recipientId]).emit('new_message', {
        message: populatedMessage,
        conversationId: conversation._id
      });
    }
    
    try {
      await NotificationController.createNotification(
        req,
        recipientId,
        `You have a new message from ${req.user.username}`,
        'message',
        req.user._id,  // This is likely supposed to be the senderId
        message._id,
        referenceId
      );
    } catch (notifError) {
      console.error('Notification error:', notifError);
      // Continue execution even if notification fails
    }
    
    // Update conversation list for recipient
    if (connectedUsers && connectedUsers[recipientId]) {
      const updatedConversation = await Conversation.findById(conversation._id)
        .populate('participants', 'username avatar')
        .populate('lastMessage');
      
      io.to(connectedUsers[recipientId]).emit('update_conversation', {
        conversation: updatedConversation
      });
    }
    
    res.status(201).json(message);
  } catch (error) {
    console.error('Message error:', error);
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
exports.deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    // Find the conversation and check if user is a participant
    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Check if user is part of this conversation
    if (!conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Delete all messages between the participants
    await Message.deleteMany({
      $or: [
        { sender: req.user._id, recipient: { $in: conversation.participants } },
        { recipient: req.user._id, sender: { $in: conversation.participants } }
      ]
    });
    
    // Delete the conversation
    await Conversation.findByIdAndDelete(conversationId);
    
    // Notify other participants if they're online
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== req.user._id.toString() && connectedUsers[participantId]) {
        io.to(connectedUsers[participantId]).emit('conversation_deleted', {
          conversationId: conversation._id
        });
      }
    });
    
    res.status(200).json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
}; 
exports.createConversation = async (req, res) => {
  try {
    const { recipientId } = req.body;
    
    if (!recipientId) {
      return res.status(400).json({ error: 'Recipient ID is required' });
    }
    
    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    
    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, recipientId] }
    });
    
    // If conversation exists, return it
    if (conversation) {
      conversation = await conversation
        .populate('participants', 'username avatar')
        .populate('lastMessage')
        .execPopulate();
        
      return res.status(200).json(conversation);
    }
    
    // Create new conversation
    const newConversation = new Conversation({
      participants: [req.user._id, recipientId],
    });
    
    await newConversation.save();
    
    // Add this in the createConversation function after saving the conversation
    try {
      await NotificationController.createNotification(
        req,
        recipientId,
        `${req.user.username} started a conversation with you`,
        'conversation',
        req.user._id,
        newConversation._id
      );
    } catch (notifError) {
      console.error('Notification error:', notifError);
      // Continue execution even if notification fails
    }
    
    // Populate and return the new conversation
    const populatedConversation = await Conversation.findById(newConversation._id)
      .populate('participants', 'username avatar');
    
    // Notify the recipient if they're online
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    
    if (connectedUsers[recipientId]) {
      io.to(connectedUsers[recipientId]).emit('new_conversation', {
        conversation: populatedConversation
      });
    }
    
    res.status(201).json(populatedConversation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create conversation' });
  }
};