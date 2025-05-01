const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const createPaymentIntent = async ({ amount, userId, auctionId, orderType = "auction-buy-now" }) => {
  return stripe.paymentIntents.create({
    amount: amount * 100, // convert to cents
    currency: "usd",
    metadata: {
      userId: userId.toString(),
      auctionId: auctionId.toString(),
      orderType,
    },
  });
};

module.exports = {
  createPaymentIntent,
};
