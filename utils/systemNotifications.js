// utils/systemNotifications.js
const { createNotification } = require('../controllers/NotificationController');

exports.sendSystemNotification = async (req, userId, message, relatedTo = null) => {
  return await createNotification(
    req,
    userId,
    message,
    'SYSTEM',
    null,
    relatedTo
  );
};

exports.sendAuctionEndingNotification = async (req, auction) => {
  // Notify owner
  await createNotification(
    req,
    auction.owner,
    `Your auction "${auction.title}" is ending in 1 hour`,
    'SYSTEM',
    null,
    { model: 'Auction', id: auction._id }
  );
  
  // Notify bidders
  const bidders = await Bid.find({
    auction: auction._id
  }).distinct('user');
  
  for (const bidderId of bidders) {
    await createNotification(
      req,
      bidderId,
      `An auction you bid on "${auction.title}" is ending in 1 hour`,
      'SYSTEM',
      null,
      { model: 'Auction', id: auction._id }
    );
  }
};