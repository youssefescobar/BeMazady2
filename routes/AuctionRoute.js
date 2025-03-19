const express = require("express");
const {
  createAuction,
  placeBid,
  getAuction,
  getAllAuctions,
  endAuction,
  updateAuction,
} = require("../controllers/AuctionController");

const router = express.Router();

router.post("/", createAuction);
router.post("/:id/bid", placeBid);
router.get("/:id", getAuction);
router.put("/:id", updateAuction);
router.get("/", getAllAuctions);
router.post("/:id/end", endAuction);

module.exports = router;
