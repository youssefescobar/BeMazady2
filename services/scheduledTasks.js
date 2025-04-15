// services/scheduledTasks.js
const cron = require('node-cron');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const User = require('../models/User');
const { createNotification } = require('../controllers/NotificationController');
const logger = require('../utils/logger'); // Add this line

// Function to end expired auctions
const endExpiredAuctions = async () => {
  try {
    const now = new Date();
    
    // Find auctions that have ended but still active
    const expiredAuctions = await Auction.find({
      endDate: { $lte: now },
      status: 'active'
    }).populate('seller').populate('item');
    
    logger.info(`Found ${expiredAuctions.length} expired auctions to process`); // Changed from console.log
    
    for (const auction of expiredAuctions) {
      logger.info(`Processing auction: ${auction._id}`); // Changed from console.log
      
      // Update auction status
      auction.status = 'completed';
      
      // Find the highest bid for this auction
      const highestBid = await Bid.findOne({ auction: auction._id })
        .sort({ amount: -1 })
        .populate('bidder');
      
      // If there's a winning bid, update the auction
      if (highestBid) {
        auction.winningBidder = highestBid.bidder._id;
        
        // Create notification for seller
        await createNotification(
          { app: global.app },
          auction.seller._id,
          `Your auction "${auction.item.name || 'Item'}" has ended with a winning bid of $${highestBid.amount}`,
          "SYSTEM",
          null,
          { model: "Auction", id: auction._id }
        );
        
        // Create notification for winning bidder
        await createNotification(
          { app: global.app },
          highestBid.bidder._id,
          `Congratulations! You won the auction for "${auction.item.name || 'Item'}" with your bid of $${highestBid.amount}`,
          "SYSTEM",
          null,
          { model: "Auction", id: auction._id }
        );
        
        // Notify other bidders they didn't win
        const otherBidders = await Bid.find({
          auction: auction._id,
          bidder: { $ne: highestBid.bidder._id }
        }).distinct('bidder');
        
        for (const bidderId of otherBidders) {
          await createNotification(
            { app: global.app },
            bidderId,
            `The auction for "${auction.item.name || 'Item'}" has ended. Your bid was not the winning bid.`,
            "SYSTEM",
            null,
            { model: "Auction", id: auction._id }
          );
        }
      } else {
        // No bids were placed
        await createNotification(
          { app: global.app },
          auction.seller._id,
          `Your auction "${auction.item.name || 'Item'}" has ended with no bids.`,
          "SYSTEM",
          null,
          { model: "Auction", id: auction._id }
        );
      }
      
      // Save the updated auction
      await auction.save();
      logger.info(`Auction ${auction._id} marked as completed`); // Changed from console.log
    }
  } catch (error) {
    logger.error(`Error in endExpiredAuctions: ${error.message}`); // Changed from console.error
    logger.error(error.stack); // Add stack trace for better debugging
  }
};

// Schedule tasks
const initScheduledTasks = (app) => {
  // Store app globally for notifications
  global.app = app;
  
  // Run every 5 minutes
  // Format: '*/5 * * * *' means "every 5 minutes"
  cron.schedule('*/5 * * * *', () => {
    logger.info('Running scheduled task: endExpiredAuctions'); // Changed from console.log
    endExpiredAuctions();
  });
  
  logger.info('Scheduled tasks initialized'); // Changed from console.log
};

module.exports = { initScheduledTasks };