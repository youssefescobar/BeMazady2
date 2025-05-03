const cron = require("node-cron");
const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const User = require("../models/User");
const { createNotification } = require("../controllers/NotificationController");
const logger = require("../utils/logger");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Function to end expired auctions
const endExpiredAuctions = async () => {
  const session = await mongoose.startSession();
  let stats = {
    totalProcessed: 0,
    withWinners: 0,
    noBids: 0,
    failed: 0
  };
  try {
    await session.withTransaction(async () => {
      const now = new Date();

      // 1. Find expired auctions
      const expiredAuctions = await Auction.find({
        endDate: { $lte: now },
        status: "active"
      })
        .populate("seller")
        .session(session);
      logger.info(`Processing ${stats.totalProcessed} expired auctions`);

      for (const auction of expiredAuctions) {
        try {
          // 2. Find highest bid
          const highestBid = await Bid.findOne({ auction: auction._id })
            .sort({ amount: -1 })
            .populate("bidder")
            .session(session);

          // 3. Update auction status
          const updateData = { 
            status: "completed",
            updatedAt: now
          };

          if (highestBid) {
            updateData.winningBidder = highestBid.bidder._id;

            // 4. Create order for winner
            const [order] = await Order.create([{
              user: highestBid.bidder._id,
              items: [{
                itemType: "auction",
                item: auction._id,
                quantity: 1,
                priceAtPurchase: highestBid.amount,
                seller: auction.seller._id
              }],
              totalAmount: highestBid.amount,
              status: "pending",
              paymentSession: {
                sessionId: "pending_auction_win",
                paymentUrl: "",
                expiresAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) // 3 days to pay
              }
            }], { session });

            // 5. Create payment link
            const stripeSession = await stripe.checkout.sessions.create({
              payment_method_types: ["card"],
              line_items: [{
                price_data: {
                  currency: "usd",
                  product_data: {
                    name: `Won Auction: ${auction.title}`,
                    description: auction.description.substring(0, 100),
                    metadata: { auctionId: auction._id.toString() }
                  },
                  unit_amount: Math.round(highestBid.amount * 100),
                },
                quantity: 1,
              }],
              mode: "payment",
              success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order._id}`,
              cancel_url: `${process.env.FRONTEND_URL}/payment/cancel?order_id=${order._id}`,
              customer_email: highestBid.bidder.email,
              metadata: { orderId: order._id.toString() },
              expires_at: Math.floor(Date.now() / 1000) + 259200 // 3 days
            });

            // 6. Update order with payment link
            order.paymentSession = {
              sessionId: stripeSession.id,
              paymentUrl: stripeSession.url,
              expiresAt: new Date(stripeSession.expires_at * 1000),
              status: "pending"
            };
            await order.save({ session });

            // 7. Notify winner with payment link
            await createNotification(
              { app: global.app },
              highestBid.bidder._id,
              `You won "${auction.title}" for $${highestBid.amount}. Pay now: ${stripeSession.url}`,
              "SYSTEM",
              null,
              { model: "Order", id: order._id }
            );
          }

          // 8. Update auction status
          await Auction.updateOne(
            { _id: auction._id },
            updateData,
            { session }
          );

          // 9. Notify seller
          const notificationMsg = highestBid
            ? `Your auction "${auction.title}" sold for $${highestBid.amount}`
            : `Your auction "${auction.title}" ended with no bids`;
          
          await createNotification(
            { app: global.app },
            auction.seller._id,
            notificationMsg,
            "SYSTEM",
            null,
            { model: "Auction", id: auction._id }
          );

        } catch (auctionError) {
          logger.error(`Failed processing auction ${auction._id}:`, auctionError);
          continue; // Process next auction even if one fails
        }
      }
    });
  } catch (error) {
    logger.error(`Transaction failed:`, error);
  } finally {
    session.endSession();
  }
};

// Schedule tasks
const initScheduledTasks = (app) => {
  global.app = app;

  // Run every minute (changed from comment saying every 5 minutes but code was every 1 minute)
  cron.schedule("*/10 * * * *", () => {
    logger.info("Running scheduled task: endExpiredAuctions");
    endExpiredAuctions();
  });

  logger.info("Scheduled tasks initialized");
};

module.exports = { initScheduledTasks };