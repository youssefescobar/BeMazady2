// utils/emaildb.js
const sendEmail = require('../utils/SendEmail'); // Your existing nodemailer setup

const auctionEmails = {
  /**
   * Notify auction winner with payment link
   * @param {string} email - Winner's email
   * @param {object} auction - Auction document
   * @param {object} order - Order document with payment link
   */
  notifyWinner: async (email, auction, order) => {
    const subject = `You won the auction for ${auction.title}!`;
    const message = `
      <h2>Congratulations!</h2>
      <p>You've won the auction for <strong>${auction.title}</strong> 
      with your bid of <strong>$${order.totalAmount}</strong>.</p>
      
      <p><a href="${order.paymentSession.paymentUrl}">Complete your payment here</a> 
      (expires ${order.paymentSession.expiresAt.toLocaleString()})</p>
      
      <p>Payment must be completed within 3 days to secure your item.</p>
      
      <small>Auction ID: ${auction._id}</small>
    `;

    await sendEmail({
      email,
      subject,
      message
    });
  },

  /**
   * Notify outbid bidders
   * @param {string} email - Loser's email
   * @param {object} auction - Auction document
   */
  notifyOutbid: async (email, auction) => {
    const subject = `Auction ended: ${auction.title}`;
    const message = `
      <h2>Auction Completed</h2>
      <p>The auction for <strong>${auction.title}</strong> has ended.</p>
      <p>Your bid was not the winning bid.</p>
      <p>Explore other auctions on our platform!</p>
    `;

    await sendEmail({
      email,
      subject,
      message
    });
  },

  /**
   * Notify Buy Now purchaser
   * @param {string} email - Buyer's email
   * @param {object} auction - Auction document
   * @param {object} order - Order document
   */
  notifyBuyNow: async (email, auction, order) => {
    const subject = `Purchase confirmed: ${auction.title}`;
    const message = `
      <h2>Thank you for your purchase!</h2>
      <p>You've purchased <strong>${auction.title}</strong> 
      for <strong>$${order.totalAmount}</strong> via Buy Now.</p>
      
      <p><a href="${order.paymentSession.paymentUrl}">Complete your payment here</a> 
      (expires ${order.paymentSession.expiresAt.toLocaleString()})</p>
      
      <p>The seller will ship your item after payment confirmation.</p>
    `;

    await sendEmail({
      email,
      subject,
      message
    });
  },

  /**
   * Notify seller about sale
   * @param {string} email - Seller's email
   * @param {object} auction - Auction document
   * @param {object} order - Order document
   */
  notifySeller: async (email, auction, order) => {
    const subject = `Your auction sold: ${auction.title}`;
    const message = `
      <h2>Your item has been sold!</h2>
      <p><strong>${auction.title}</strong> sold for 
      <strong>$${order.totalAmount}</strong>.</p>
      
      ${order.status === 'paid' ? 
        '<p>The buyer has completed payment. Please prepare the item for shipping.' : 
        '<p>Waiting for buyer payment. You\'ll receive another email when payment is complete.'}
      
      <p>Auction ID: ${auction._id}</p>
    `;

    await sendEmail({
      email,
      subject,
      message
    });
  },

  /**
   * Notify seller about unsuccessful auction
   * @param {string} email - Seller's email
   * @param {object} auction - Auction document
   */
  notifyUnsuccessfulAuction: async (email, auction) => {
    const subject = `Auction ended: ${auction.title}`;
    const message = `
      <h2>Auction Completed</h2>
      <p>Your auction for <strong>${auction.title}</strong> 
      has ended with no winning bids.</p>
      
      <p>You may relist the item if you wish.</p>
    `;

    await sendEmail({
      email,
      subject,
      message
    });
  }
};

module.exports = auctionEmails;