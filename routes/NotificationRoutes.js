// routes/NotificationRoutes.js
const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/NotificationController');
const { authenticateUser } = require('../middlewares/AuthMiddle');

router.get('/', authenticateUser, NotificationController.getUserNotifications);
router.put('/read/:id', authenticateUser, NotificationController.markAsRead);
router.put('/read-all', authenticateUser, NotificationController.markAllAsRead);
router.get('/unread-count', authenticateUser, NotificationController.getUnreadCount);
router.post('/create', authenticateUser, NotificationController.createNotification);
module.exports = router;