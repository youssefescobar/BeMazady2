// services/auctionService.js
const Auction = require("../models/Auction");
const { createNotification } = require("../controllers/NotificationController");
const sendEmail = require('../utils/SendEmail');

// Function to create a pending auction entry
const createAuctionPending = async (data) => {
  const auction = await Auction.create({
    ...data,
    status: "pending", // Always set status as pending initially
  });

  return auction;
};

// Function to handle moderation asynchronously (sending to Hugging Face)
// Inside your moderateAuctionAsync function
const moderateAuctionAsync = async (auctionId, imageUrl, description, user) => {
    try {
      // Dynamically import the Client from @gradio/client
      const { Client } = await import('@gradio/client');
    
      const client = await Client.connect("usef143/Auto-enlister");
    
      // Send request to Hugging Face model
      const result = await client.predict("/predict", {
        image_url: imageUrl,
        description: description,
      });
  
      const { valid, reason } = result.data[0]; // Assuming Hugging Face returns {valid: 1, reason: "some reason"}
    
      let status = "pending"; // Default
      let moderationReason = reason || ""; // If reason is null or undefined, set as empty string
    
      if (valid === 1) {
        status = "active"; // Pass
      } else {
        status = "declined"; // Fail
        moderationReason = moderationReason || "Validation failed"; // Ensure reason is populated when declined
      }
  
      // Update auction status
      const updatedAuction = await Auction.findByIdAndUpdate(
        auctionId,
        { status, moderationReason },
        { new: true }
      );
    
      // Check if user is available and has email before sending email
      if (user && user.email) {
        // Create a stylish email template to match your design
        const emailHtml = `
          <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
              <div style="background-color: #f4f4f9; padding: 30px; border-radius: 8px; max-width: 600px; margin: auto; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                <h2 style="color: #2c3e50; font-size: 24px; text-align: center;">Your Auction Moderation Status</h2>
                <p style="font-size: 16px; line-height: 1.5;">
                  Dear <strong>${user.username || 'Valued User'}</strong>,
                </p>
                <p style="font-size: 16px; line-height: 1.5;">
                  We wanted to inform you that your auction titled <strong>"${updatedAuction.title}"</strong> has been <strong>${status}</strong>.
                </p>
                ${moderationReason ? `
                  <p style="font-size: 16px; line-height: 1.5; color: #e74c3c;">
                    <strong>Reason:</strong> <em>${moderationReason}</em>
                  </p>` : ''}
                <p style="font-size: 16px; line-height: 1.5;">
                  Thank you for using BeMazady!<br> If you have any questions or need assistance, feel free to contact us.
                </p>
                <hr style="border-top: 1px solid #ccc; margin: 20px 0;">
                <footer style="font-size: 14px; text-align: center; color: #7f8c8d;">
                  <p>BeMazady Team</p>
                  <p>If you did not request this email, please ignore it.</p>
                </footer>
              </div>
            </body>
          </html>
        `;
        
        await sendEmail({
          email: user.email,
          subject: `Your Auction "${updatedAuction.title}" Moderation Status`,
          message: emailHtml,
        });
      } else {
        console.error("❌ User email is not defined or invalid.");
      }
    
      if (process.env.ADMIN_USER_ID) {
        await createNotification(
          user,
          process.env.ADMIN_USER_ID,
          `Auction "${updatedAuction.title}" has been ${status} by model.`,
          "SYSTEM",
          null,
          { model: "Auction", id: updatedAuction._id }
        );
      }
    
      return updatedAuction;
    } catch (error) {
      console.error("Moderation API error:", error);
      return {
        passed: false,
        reason: "Failed to connect to moderation model",
      };
    }
  };
  
  
module.exports = {
  createAuctionPending,
  moderateAuctionAsync,
};
