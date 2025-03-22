// utils/socketUtils.js
exports.sendNotificationToUser = (req, userId, notification) => {
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    
    if (connectedUsers[userId.toString()]) {
      io.to(connectedUsers[userId.toString()]).emit('new_notification', {
        notification
      });
    }
  };
  
  exports.sendMessageToUser = (req, userId, message, conversationId) => {
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    
    if (connectedUsers[userId.toString()]) {
      io.to(connectedUsers[userId.toString()]).emit('new_message', {
        message,
        conversationId
      });
    }
  };
  
  exports.updateConversationForUser = (req, userId, conversation) => {
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    
    if (connectedUsers[userId.toString()]) {
      io.to(connectedUsers[userId.toString()]).emit('update_conversation', {
        conversation
      });
    }
  };