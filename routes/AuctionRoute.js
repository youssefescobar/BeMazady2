const express = require("express");
const {
  createAuction,
  placeBid,
  getAuction,
  getAllAuctions,
  endAuction,
  updateAuction,
} = require("../controllers/AuctionController");
const {
  CreateAuctionValidator,
  PlaceBidValidator,
  GetAuctionValidator,
  UpdateAuctionValidator,
  EndAuctionValidator,
} = require("../utils/Validators/AuctionValid");
const router = express.Router();

router.post("/", CreateAuctionValidator, createAuction);
router.post("/:id/bid", PlaceBidValidator, placeBid);
router.get("/:id", GetAuctionValidator, getAuction);
router.put("/:id", UpdateAuctionValidator, updateAuction);
router.get("/", getAllAuctions);
router.post("/:id/end", EndAuctionValidator, endAuction);

module.exports = router;
