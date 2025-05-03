// utils/emaildb.js
const sendEmail = require('../utils/SendEmail'); // Your existing nodemailer setup

const auctionEmails = {
  /**
   * Notify auction winner with payment link
   * @param {string} email - Winner's email
   * @param {object} auction - Auction document
   * @param {object} order - Order document with payment link
   */
  /**
 * Notifies the auction winner via email with payment instructions
 * @param {string} email - Winner's email address
 * @param {object} auction - Auction details
 * @param {object} order - Order/payment details
 */
    notifyWinner : async (email, auction, order) => {
    const paymentExpiryDate = order.paymentSession.expiresAt.toLocaleString();
    const paymentDeadline = new Date(order.paymentSession.expiresAt);
    paymentDeadline.setDate(paymentDeadline.getDate() + 3);
    
    const subject = `Congratulations! You won: ${auction.title}`;
    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2ecc71;">Congratulations!</h1>
        
        <p style="font-size: 16px; line-height: 1.6;">
          You've successfully won the auction for <strong>${auction.title}</strong> 
          with your winning bid of <strong>$${order.totalAmount.toFixed(2)}</strong>.
        </p>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Next Steps:</h3>
          <ol style="padding-left: 20px;">
            <li style="margin-bottom: 10px;">
              <a href="${order.paymentSession.paymentUrl}" 
                style="color: #3498db; text-decoration: none; font-weight: bold;">
                Complete your payment here
              </a> 
              <span style="color: #7f8c8d; font-size: 14px;">
                (Link expires: ${paymentExpiryDate})
              </span>
            </li>
            <li>Payment must be completed by ${paymentDeadline.toLocaleString()} to secure your item</li>
          </ol>
        </div>
        
        <p style="font-size: 14px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 15px;">
          Auction ID: ${auction._id}<br>
          Thank you for participating in our auction!
        </p>
      </div>
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