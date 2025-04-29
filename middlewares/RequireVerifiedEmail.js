const requireVerifiedEmail = async (req, res, next) => {
    try {
      const user = req.user; // You already have full user from protect
  
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
  
      if (!user.verified) {
        return res.status(403).json({
          success: false,
          message: "You must verify your email to perform this action.",
        });
      }
  
      next();
    } catch (error) {
      console.error("Email verification check failed:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
  
  module.exports = requireVerifiedEmail;
  