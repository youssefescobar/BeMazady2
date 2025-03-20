// controllers/NotificationController.js
const Notification = require('../models/Notification');

exports.createNotification = async (req, recipient, message, type, sender = null, relatedTo = null) => {
  try {
    const notification = new Notification({
      recipient,
      sender,
      type,
      message,
      relatedTo
    });
    
    await notification.save();
    
    // Send real-time notification if user is online
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    
    if (connectedUsers[recipient.toString()]) {
      io.to(connectedUsers[recipient.toString()]).emit('new_notification', {
        notification: await Notification.findById(notification._id)
          .populate('sender', 'username')
      });
    }
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};
exports.getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .populate('sender', 'username')
      .limit(50);
    
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true }
    );
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
};
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false
    });
    
    res.status(200).json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};