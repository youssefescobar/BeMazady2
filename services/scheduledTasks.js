const cron = require("node-cron");
const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const User = require("../models/User");
const { createNotification } = require("../controllers/NotificationController");
const logger = require("../utils/logger");

// Function to end expired auctions
const endExpiredAuctions = async () => {
  try {
    const now = new Date();

    // Find auctions that have ended but are still active
    const expiredAuctions = await Auction.find({
      endDate: { $lte: now },
      status: "active",
    }).populate("seller");

    logger.info(`Found ${expiredAuctions.length} expired auctions to process`);

    for (const auction of expiredAuctions) {
      logger.info(`Processing auction: ${auction._id}`);

      const auctionName = auction.title || "Auction Item";

      // Find the highest bid for this auction
      const highestBid = await Bid.findOne({ auction: auction._id })
        .sort({ amount: -1 })
        .populate("bidder");

      let updateData = { status: "completed" };

      if (highestBid) {
        updateData.winningBidder = highestBid.bidder._id;

        // Notify seller
        await createNotification(
          { app: global.app },
          auction.seller._id,
          `Your auction "${auctionName}" has ended with a winning bid of $${highestBid.amount}`,
          "SYSTEM",
          null,
          { model: "Auction", id: auction._id }
        );

        // Notify winner with payment info
        await createNotification(
          { app: global.app },
          highestBid.bidder._id,
          `Congratulations! You won the auction for "${auctionName}" with your bid of $${highestBid.amount}. Please complete your payment.`,
          "SYSTEM",
          null,
          { model: "Auction", id: auction._id } // Changed from Order to Auction since order._id wasn't defined
        );

        // Notify other bidders
        const otherBidders = await Bid.find({
          auction: auction._id,
          bidder: { $ne: highestBid.bidder._id },
        }).distinct("bidder");

        for (const bidderId of otherBidders) {
          await createNotification(
            { app: global.app },
            bidderId,
            `The auction for "${auctionName}" has ended. Your bid was not the winning bid.`,
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
          `Your auction "${auctionName}" has ended with no bids.`,
          "SYSTEM",
          null,
          { model: "Auction", id: auction._id }
        );
      }

      // Update only the necessary fields instead of saving the whole doc
      await Auction.updateOne({ _id: auction._id }, updateData);

      logger.info(`Auction ${auction._id} marked as completed`);
    }
  } catch (error) {
    logger.error(`Error in endExpiredAuctions: ${error.message}`);
    logger.error(error.stack);
  }
};

// Schedule tasks
const initScheduledTasks = (app) => {
  global.app = app;

  // Run every minute (changed from comment saying every 5 minutes but code was every 1 minute)
  cron.schedule("*/1 * * * *", () => {
    logger.info("Running scheduled task: endExpiredAuctions");
    endExpiredAuctions();
  });

  logger.info("Scheduled tasks initialized");
};

module.exports = { initScheduledTasks };