const { body } = require("express-validator");
const validatorr = require("../middlewares/ValidatorMiddle");

const auctionValidationRules = {
  create: [
    body("title")
      .notEmpty().withMessage("Title is required")
      .isLength({ min: 3, max: 100 }).withMessage("Title must be between 3 and 100 characters"),
      
    body("description")
      .notEmpty().withMessage("Description is required")
      .isLength({ min: 20, max: 1000 }).withMessage("Description must be between 20 and 1000 characters"),
      
    body("category")
      .notEmpty().withMessage("Category is required")
      .isIn(["art", "vehicles", "electronics", "collectibles", "real-estate", "other"])
      .withMessage("Invalid category"),
      
    body("startingPrice")
      .notEmpty().withMessage("Starting price is required")
      .isNumeric().withMessage("Starting price must be a number")
      .isFloat({ min: 0 }).withMessage("Starting price must be positive"),
      
    body("minBidIncrement")
      .optional()
      .isNumeric().withMessage("Minimum bid increment must be a number")
      .isFloat({ min: 1 }).withMessage("Minimum bid increment must be at least 1"),
      
    body("startTime")
      .notEmpty().withMessage("Start time is required")
      .isISO8601().withMessage("Start time must be a valid date")
      .custom((value) => {
        const startDate = new Date(value);
        const now = new Date();
        if (startDate < now) {
          throw new Error("Start time must be in the future");
        }
        return true;
      }),
      
    body("endTime")
      .notEmpty().withMessage("End time is required")
      .isISO8601().withMessage("End time must be a valid date")
      .custom((value, { req }) => {
        const endDate = new Date(value);
        const startDate = new Date(req.body.startTime);
        
        // Check if end date is after start date
        if (endDate <= startDate) {
          throw new Error("End time must be after start time");
        }
        
        // Check if auction duration is at least 1 hour
        const minDuration = 1 * 60 * 60 * 1000; // 1 hour in milliseconds
        if (endDate - startDate < minDuration) {
          throw new Error("Auction must be at least 1 hour long");
        }
        
        // Check if auction duration is not more than 30 days
        const maxDuration = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
        if (endDate - startDate > maxDuration) {
          throw new Error("Auction duration cannot exceed 30 days");
        }
        
        return true;
      }),
      
    body("images")
      .optional()
      .isArray().withMessage("Images must be an array")
      .custom((value) => {
        if (value && value.length > 10) {
          throw new Error("Maximum 10 images allowed");
        }
        return true;
      }),
      
    validatorr,
  ],
  
  update: [
    body("title")
      .optional()
      .isLength({ min: 3, max: 100 }).withMessage("Title must be between 3 and 100 characters"),
      
    body("description")
      .optional()
      .isLength({ min: 20, max: 1000 }).withMessage("Description must be between 20 and 1000 characters"),
      
    body("category")
      .optional()
      .isIn(["art", "vehicles", "electronics", "collectibles", "real-estate", "other"])
      .withMessage("Invalid category"),
      
    body("startingPrice")
      .optional()
      .isNumeric().withMessage("Starting price must be a number")
      .isFloat({ min: 0 }).withMessage("Starting price must be positive"),
      
    body("minBidIncrement")
      .optional()
      .isNumeric().withMessage("Minimum bid increment must be a number")
      .isFloat({ min: 1 }).withMessage("Minimum bid increment must be at least 1"),
      
    body("startTime")
      .optional()
      .isISO8601().withMessage("Start time must be a valid date"),
      
    body("endTime")
      .optional()
      .isISO8601().withMessage("End time must be a valid date")
      .custom((value, { req }) => {
        if (!value) return true;
        
        const endDate = new Date(value);
        let startDate;
        
        if (req.body.startTime) {
          startDate = new Date(req.body.startTime);
        } else {
          // We'll need to get the current startTime from the database
          // This is handled in the controller
          return true;
        }
        
        if (endDate <= startDate) {
          throw new Error("End time must be after start time");
        }
        
        return true;
      }),
      
    body("status")
      .optional()
      .isIn(["pending", "active", "ended", "cancelled"])
      .withMessage("Invalid status"),
      
    body("images")
      .optional()
      .isArray().withMessage("Images must be an array")
      .custom((value) => {
        if (value && value.length > 10) {
          throw new Error("Maximum 10 images allowed");
        }
        return true;
      }),
      
    validatorr,
  ]
};

const bidValidationRules = [
  body("amount")
    .notEmpty().withMessage("Bid amount is required")
    .isNumeric().withMessage("Bid amount must be a number")
    .isFloat({ min: 0 }).withMessage("Bid amount must be positive"),
    
  validatorr
];

module.exports = { auctionValidationRules, bidValidationRules };
