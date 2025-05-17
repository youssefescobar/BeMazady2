// controllers/MessageController.js
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const NotificationController = require('../controllers/NotificationController');

exports.getConversations = async (req, res) => {
  try {
    // Get all conversations for the user
    const conversations = await Conversation.find({
      participants: req.user._id
    })
    .populate('participants', 'username avatar')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });

    // Enhance each conversation with unread message count
    const enhancedConversations = await Promise.all(
      conversations.map(async (conversation) => {
        // Find the other participant (not the current user)
        const otherParticipant = conversation.participants.find(
          p => p._id.toString() !== req.user._id.toString()
        );

        // Count unread messages in this conversation
        const unreadCount = await Message.countDocuments({
          sender: otherParticipant._id,
          recipient: req.user._id,
          isRead: false
        });

        // Convert to plain object to add the unreadCount property
        const conversationObj = conversation.toObject();
        conversationObj.unreadCount = unreadCount;
        
        return conversationObj;
      })
    );
    
    res.status(200).json(enhancedConversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
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
    .populate('sender', 'username avatar')
    .populate('recipient', 'username avatar'); 
    
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
      referenceId
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
    
    // Create notification
    try {
      await NotificationController.createNotification(
        req,
        recipientId,
        `You have a new message from ${req.user.username}`,
        'message',
        req.user._id,
        message._id,
        referenceId
      );
    } catch (notifError) {
      console.error('Notification error:', notifError);
    }
    
    // Update conversation list for both participants with unread counts
    const updateConversationForUser = async (userId, isRecipient = false) => {
      if (connectedUsers && connectedUsers[userId]) {
        const updatedConversation = await Conversation.findById(conversation._id)
          .populate('participants', 'username avatar')
          .populate('lastMessage');
        
        // Calculate unread count for this user
        const otherParticipantId = userId === req.user._id.toString() ? recipientId : req.user._id;
        const unreadCount = isRecipient 
          ? 1 // This is a new message, so recipient has 1 unread
          : await Message.countDocuments({
              sender: otherParticipantId,
              recipient: userId,
              isRead: false
            });
        
        const conversationObj = updatedConversation.toObject();
        conversationObj.unreadCount = unreadCount;
        
        io.to(connectedUsers[userId]).emit('update_conversation', {
          conversation: conversationObj
        });
      }
    };
    
    // Update for recipient (with unread count = 1)
    await updateConversationForUser(recipientId, true);
    
    // Update for sender (with their actual unread count)
    await updateConversationForUser(req.user._id.toString());
    
    res.status(201).json({
      message: populatedMessage,
      conversationId: conversation._id
    });
  } catch (error) {
    console.error('Message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Find the other participant
    const otherParticipant = conversation.participants.find(
      p => p.toString() !== req.user._id.toString()
    );
    
    await Message.updateMany(
      { 
        sender: otherParticipant,
        recipient: req.user._id,
        isRead: false
      },
      { isRead: true }
    );
    
    // Emit update to the other participant that messages were read
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    
    if (connectedUsers && connectedUsers[otherParticipant]) {
      const updatedConversation = await Conversation.findById(conversationId)
        .populate('participants', 'username avatar')
        .populate('lastMessage');
      
      // Unread count should now be 0 since we just marked them as read
      const conversationObj = updatedConversation.toObject();
      conversationObj.unreadCount = 0;
      
      io.to(connectedUsers[otherParticipant]).emit('update_conversation', {
        conversation: conversationObj
      });
    }
    
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
    
    // Check permissions based on user roles
    const senderRole = req.user.role;
    const recipientRole = recipient.role;
    
    // Allow conversations only between: buyer-seller, buyer-admin, seller-admin, admin-admin
    const isAllowed = 
      // Admin can talk to anyone (including other admins)
      senderRole === 'admin' ||
      // Recipient is admin (anyone can message admin)
      recipientRole === 'admin' ||
      // Buyer can message seller and vice versa
      (senderRole === 'buyer' && recipientRole === 'seller') ||
      (senderRole === 'seller' && recipientRole === 'buyer');
    
    if (!isAllowed) {
      return res.status(403).json({ 
        error: 'You cannot start a conversation with this user type' 
      });
    }
    
    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, recipientId] }
    });
    
    // If conversation exists, return it
    if (conversation) {
      conversation = await conversation
        .populate('participants', 'username avatar role')
        .populate('lastMessage')
        .execPopulate();
        
      return res.status(200).json(conversation);
    }
    
    // Create new conversation
    const newConversation = new Conversation({
      participants: [req.user._id, recipientId],
    });
    
    await newConversation.save();
    
    // Add notification after saving the conversation
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
      .populate('participants', 'username avatar role');
    
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