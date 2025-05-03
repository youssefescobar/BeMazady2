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
    const subject = `Auction Ended: ${auction.title}`;
    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #e74c3c;">Better luck next time!</h1>
  
        <p style="font-size: 16px; line-height: 1.6;">
          The auction for <strong>${auction.title}</strong> has ended, and unfortunately, your bid was not the highest.
        </p>
  
        <p style="font-size: 16px; line-height: 1.6;">
          Don't worry — new auctions are starting every day. Check back soon for more exciting opportunities.
        </p>
  
        <p style="font-size: 14px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 15px;">
          Auction ID: ${auction._id}<br>
          Thank you for participating!
        </p>
      </div>
    `;
  
    await sendEmail({ email, subject, message });
  },
  

  /**
   * Notify Buy Now purchaser
   * @param {string} email - Buyer's email
   * @param {object} auction - Auction document
   * @param {object} order - Order document
   */
  notifyBuyNow: async (email, auction, order) => {
    const paymentExpiryDate = order.paymentSession.expiresAt.toLocaleString();
  
    const subject = `Purchase Confirmed: ${auction.title}`;
    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2ecc71;">Thank you for your purchase!</h1>
  
        <p style="font-size: 16px; line-height: 1.6;">
          You've successfully purchased <strong>${auction.title}</strong> 
          for <strong>$${order.totalAmount.toFixed(2)}</strong> using Buy Now.
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
            <li>The seller will ship your item after payment confirmation.</li>
          </ol>
        </div>
  
        <p style="font-size: 14px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 15px;">
          Auction ID: ${auction._id}<br>
          Thanks for shopping with us!
        </p>
      </div>
    `;
  
    await sendEmail({ email, subject, message });
  },
  

  /**
   * Notify seller about sale
   * @param {string} email - Seller's email
   * @param {object} auction - Auction document
   * @param {object} order - Order document
   */
  notifySeller: async (email, auction, order) => {
    const subject = `Your Auction Sold: ${auction.title}`;
    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2c3e50;">Your item has been sold!</h1>
  
        <p style="font-size: 16px; line-height: 1.6;">
          <strong>${auction.title}</strong> was sold for <strong>$${order.totalAmount.toFixed(2)}</strong>.
        </p>
  
        <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
          ${order.status === 'paid' ? 
            '<p style="color: #27ae60;">The buyer has completed payment. Please prepare the item for shipping.</p>' :
            '<p style="color: #e67e22;">Waiting for buyer payment. You’ll receive another email once payment is confirmed.</p>'
          }
        </div>
  
        <p style="font-size: 14px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 15px;">
          Auction ID: ${auction._id}<br>
          Great job on the successful sale!
        </p>
      </div>
    `;
  
    await sendEmail({ email, subject, message });
  },
  

  /**
   * Notify seller about unsuccessful auction
   * @param {string} email - Seller's email
   * @param {object} auction - Auction document
   */
  notifyUnsuccessfulAuction: async (email, auction) => {
    const subject = `Auction Ended: ${auction.title}`;
    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #95a5a6;">No winning bids</h1>
  
        <p style="font-size: 16px; line-height: 1.6;">
          Your auction for <strong>${auction.title}</strong> has ended without any winning bids.
        </p>
  
        <p style="font-size: 16px; line-height: 1.6;">
          You can relist the item to try again — many successful auctions come from relisting!
        </p>
  
        <p style="font-size: 14px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 15px;">
          Auction ID: ${auction._id}<br>
          Thank you for using our platform!
        </p>
      </div>
    `;
  
    await sendEmail({ email, subject, message });
  },
    /**
   * Send order confirmation email for normal e-commerce checkout
   * @param {string} email - Buyer's email
   * @param {Array} items - Array of item objects in the order
   * @param {object} order - Order document (including payment link)
   */
    sendOrderEmail: async (email, items, order) => {
      const paymentExpiryDate = order.paymentSession.expiresAt.toLocaleString();
  
      const subject = `Order Confirmation - ${items.length} item(s) in your cart`;
      const itemListHtml = items.map(item => `
        <li style="margin-bottom: 8px;">
          ${item.title} — $${item.price.toFixed(2)}
        </li>
      `).join("");
  
      const message = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2ecc71;">Order Received</h1>
          <p style="font-size: 16px;">
            <strong>Total:</strong> $${order.totalAmount.toFixed(2)}
          </p>
  
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Next Step:</h3>
            <p>
              Please complete your payment using the link below:
              <br>
              <a href="${order.paymentSession.paymentUrl}" style="color: #3498db; font-weight: bold;">
                Complete Payment
              </a>
              <br>
              <span style="font-size: 14px; color: #7f8c8d;">(Expires: ${paymentExpiryDate})</span>
            </p>
          </div>
  
          <p style="font-size: 14px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 15px;">
            Order ID: ${order._id}<br>
            We’ll notify you once your items are shipped.
          </p>
        </div>
      `;
  
      await sendEmail({ email, subject, message });
    },
  
  
};

module.exports = auctionEmails;