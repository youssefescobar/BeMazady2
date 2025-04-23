const { check } = require("express-validator");
const validatorr = require("../../middlewares/ValidatorMiddle");
const UserModel = require("../../models/User");
const ItemModel = require("../../models/Item");
const AuctionModel = require("../../models/Auction");

const CreateAuctionValidator = [

  check("seller")
    .isMongoId()
    .withMessage("Invalid seller ID")
    .custom(async (userId) => {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error(`No user found with ID: ${userId}`);
      }
      if (!["seller", "admin"].includes(user.role)) {
        throw new Error("User must have a role of seller");
      }
    }),
  check("startPrice")
    .isFloat({ gt: 0 })
    .withMessage("Start price must be greater than 0"),
  check("reservePrice")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Reserve price must be greater than 0"),
  check("buyNowPrice")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Buy now price must be greater than 0"),
  check("minimumBidIncrement")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Minimum bid increment must be greater than 0"),
  check("endDate").isISO8601().withMessage("Invalid end date"),
  validatorr,
];

const PlaceBidValidator = [
  check("id").isMongoId().withMessage("Invalid auction ID"),
  check("amount")
    .isFloat({ gt: 0 })
    .withMessage("Bid amount must be greater than 0"),
  check("bidder")
    .isMongoId()
    .withMessage("Invalid bidder ID")
    .custom(async (userId, { req }) => {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error(`No user found with ID: ${userId}`);
      }

      const auction = await AuctionModel.findById(req.params.id);
      if (!auction) {
        throw new Error("Auction not found");
      }

      if (auction.seller.toString() === userId) {
        throw new Error("Seller cannot bid on their own auction");
      }
    }),
  validatorr,
];

const GetAuctionValidator = [
  check("id").isMongoId().withMessage("Invalid auction ID"),
  validatorr,
];

const UpdateAuctionValidator = [
  check("id").isMongoId().withMessage("Invalid auction ID"),
  check("startPrice")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Start price must be greater than 0"),
  check("reservePrice")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Reserve price must be greater than 0"),
  check("buyNowPrice")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Buy now price must be greater than 0"),
  check("minimumBidIncrement")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Minimum bid increment must be greater than 0"),
  check("endDate").optional().isISO8601().withMessage("Invalid end date"),
  validatorr,
];

const EndAuctionValidator = [
  check("id").isMongoId().withMessage("Invalid auction ID"),
  validatorr,
];

module.exports = {
  CreateAuctionValidator,
  PlaceBidValidator,
  GetAuctionValidator,
  UpdateAuctionValidator,
  EndAuctionValidator,
};
