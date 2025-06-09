const cron = require("node-cron");
const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const User = require("../models/User");
const { createNotification } = require("../controllers/NotificationController");
const logger = require("../utils/logger");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const auctionEmails = require("../extra/Emaildb");

// Function to end expired auctions
const endExpiredAuctions = async () => {
  const session = await mongoose.startSession();
  let stats = {
    totalProcessed: 0,
    withWinners: 0,
    noBids: 0,
    failed: 0,
  };

  try {
    await session.withTransaction(async () => {
      const now = new Date();

      const expiredAuctions = await Auction.find({
        endDate: { $lte: now },
        status: "active",
      })
        .populate("seller")
        .session(session)
        .lean();

      stats.totalProcessed = expiredAuctions.length;
      logger.info(`Processing ${stats.totalProcessed} expired auctions`);

      for (const auction of expiredAuctions) {
        try {
          const highestBid = await Bid.findOne({ auction: auction._id })
            .sort({ amount: -1 })
            .populate("bidder")
            .session(session);

          const otherBids = highestBid
            ? await Bid.find({
                auction: auction._id,
                bidder: { $ne: highestBid.bidder._id },
              })
                .populate("bidder")
                .session(session)
            : [];

          const updateData = {
            $set: {
              status: "completed",
              updatedAt: now,
            },
            $inc: { __v: 1 },
          };

          if (highestBid) {
            stats.withWinners++;
            updateData.$set.winningBidder = highestBid.bidder._id;

            const [order] = await Order.create(
              [
                {
                  user: highestBid.bidder._id,
                  items: [
                    {
                      itemType: "auction",
                      item: auction._id,
                      quantity: 1,
                      priceAtPurchase: highestBid.amount,
                      seller: auction.seller._id,
                      metadata: {
                        auctionTitle: auction.title,
                        auctionEnd: auction.endDate,
                      },
                    },
                  ],
                  totalAmount: highestBid.amount,
                  status: "pending",
                  paymentSession: {
                    sessionId: `pending_${auction._id}`,
                    paymentUrl: "about:blank", // placeholder initially
                    expiresAt: new Date(now.getTime() + 72 * 60 * 60 * 1000), // 72 hours
                    status: "awaiting_payment",
                  },
                  shippingRequired: auction.requiresShipping || false,
                },
              ],
              { session }
            );

            const idempotencyKey = `auction_${auction._id}_${
              highestBid.bidder._id
            }_${Date.now()}`;

            try {
              const stripeSession = await stripe.checkout.sessions.create(
                {
                  payment_method_types: ["card"],
                  line_items: [
                    {
                      price_data: {
                        currency: "egp",
                        product_data: {
                          name: `Won Auction: ${auction.title}`,
                          description: `Auction ended ${auction.endDate.toLocaleDateString()}`,
                          images: [auction.auctionCover],
                          metadata: {
                            auctionId: auction._id.toString(),
                            winningBidId: highestBid._id.toString(),
                          },
                        },
                        unit_amount: Math.round(highestBid.amount * 100),
                      },
                      quantity: 1,
                    },
                  ],
                  mode: "payment",
                  success_url: `${process.env.FRONTEND_URL}/payment/success`,
                  cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
                  customer_email: highestBid.bidder.email,
                  client_reference_id: order._id.toString(),
                  metadata: {
                    orderId: order._id.toString(),
                    auctionId: auction._id.toString(),
                    type: "auction_win",
                  },
                  expires_at: Math.floor(now.getTime() / 1000) + 86400, // 24 hours

                  payment_intent_data: {
                    capture_method: "manual",
                    metadata: {
                      auction_id: auction._id.toString(),
                    },
                  },
                },
                { idempotencyKey }
              );

              await Order.updateOne(
                { _id: order._id },
                {
                  $set: {
                    "paymentSession.sessionId": stripeSession.id,
                    "paymentSession.paymentUrl": stripeSession.url,
                    "paymentSession.expiresAt": new Date(
                      stripeSession.expires_at * 1000
                    ),
                    updatedAt: now,
                  },
                },
                { session }
              );

              // Refresh the order after update to get the correct payment URL
              const updatedOrder = await Order.findById(order._id).session(
                session
              );

              await Promise.all([
                auctionEmails.notifyWinner(
                  highestBid.bidder.email,
                  auction,
                  updatedOrder
                ),
                auctionEmails.notifySeller(
                  auction.seller.email,
                  auction,
                  updatedOrder
                ),
                ...otherBids.map((bid) =>
                  auctionEmails.notifyOutbid(bid.bidder.email, auction)
                ),
                createNotification(
                  { app: global.app },
                  highestBid.bidder._id,
                  `You won "${auction.title}" for ${highestBid.amount}`,
                  "SYSTEM",
                  null,
                  { model: "Order", id: updatedOrder._id }
                ),
                createNotification(
                  { app: global.app },
                  auction.seller._id,
                  `Auction sold: ${auction.title} for ${highestBid.amount}`,
                  "SYSTEM",
                  highestBid.bidder._id,
                  { model: "Auction", id: auction._id }
                ),
              ]);
            } catch (stripeError) {
              logger.error(
                `Stripe session creation failed: ${stripeError.message}`,
                {
                  auctionId: auction._id,
                }
              );

              // Still proceed with notifications but inform about payment issue
              await Promise.all([
                auctionEmails.notifyWinner(highestBid.bidder.email, auction, {
                  ...order.toObject(),
                  paymentIssue: true,
                }),
                auctionEmails.notifySeller(auction.seller.email, auction, {
                  ...order.toObject(),
                  paymentIssue: true,
                }),
                createNotification(
                  { app: global.app },
                  highestBid.bidder._id,
                  `You won "${auction.title}" for ${highestBid.amount}. There was an issue with payment processing. Our team will contact you.`,
                  "SYSTEM",
                  null,
                  { model: "Order", id: order._id }
                ),
              ]);

              // Throw the error to be caught by the outer try/catch
              throw stripeError;
            }
          } else {
            stats.noBids++;

            await Promise.all([
              auctionEmails.notifyUnsuccessfulAuction(
                auction.seller.email,
                auction
              ),
              createNotification(
                { app: global.app },
                auction.seller._id,
                `Auction ended with no bids: ${auction.title}`,
                "SYSTEM",
                null,
                { model: "Auction", id: auction._id }
              ),
            ]);
          }

          await Auction.updateOne({ _id: auction._id }, updateData, {
            session,
          });
        } catch (auctionError) {
          stats.failed++;
          logger.error(
            `Auction ${auction._id} processing failed: ${
              auctionError.message || auctionError
            }`,
            {
              auctionId: auction._id,
            }
          );
        }
      }

      logger.info("Auction processing completed", { stats });
    });
  } catch (error) {
    logger.error("Transaction failed", {
      error: error.message || error,
      sessionId: session.id,
    });
    throw error;
  } finally {
    await session.endSession();
  }

  return stats;
};

// Schedule tasks
const initScheduledTasks = (app) => {
  global.app = app;

  // Run every minute
  cron.schedule("*/5 * * * *", () => {
    logger.info("Running scheduled task: endExpiredAuctions");
    endExpiredAuctions();
  });

  logger.info("Scheduled tasks initialized");
};

module.exports = { initScheduledTasks };
