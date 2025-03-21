// routes/NotificationRoutes.js
const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/NotificationController');
const { authenticateUser } = require('../middlewares/AuthMiddle');

// Change this line to use createNotificationAPI instead of createNotification
router.post('/create', authenticateUser, NotificationController.createNotificationAPI);
router.get('/', authenticateUser, NotificationController.getUserNotifications);
router.put('/read/:id', authenticateUser, NotificationController.markAsRead);
router.put('/read-all', authenticateUser, NotificationController.markAllAsRead);
router.get('/unread-count', authenticateUser, NotificationController.getUnreadCount);

module.exports = router;