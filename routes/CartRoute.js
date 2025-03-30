const express = require("express");
const {
  GetCart,
  AddToCart,
  RemoveFromCart,
  ClearCart,
} = require("../controllers/CartController");
const protect = require("../middlewares/AuthMiddle");

const router = express.Router();

router.get("/", protect, GetCart);
router.post("/add", protect, AddToCart);
router.delete("/remove", protect, RemoveFromCart);
router.delete("/clear", protect, ClearCart);

module.exports = router;
