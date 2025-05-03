const express = require('express');
const {
  createOrder,
  getOrder,
  updateOrderStatus,
  getMyOrders,
  getAllOrders,
  processRefund
} = require('../controllers/OrderController');
const protect = require('../middlewares/AuthMiddle');
const authorize = require('../middlewares/AuthorizeMiddle'); // Fixed import path

const router = express.Router();

router.route('/')
  .post(protect, createOrder)//ok
  .get(protect, authorize('admin'), getAllOrders);//ok

router.route('/my-orders').get(protect, getMyOrders);//ok
router.route('/:id').get(protect, getOrder); //ok
router.route('/:id/status').put(protect, authorize('admin'), updateOrderStatus);
// router.route('/:id/refund').post(protect, authorize('admin'), processRefund);

module.exports = router;