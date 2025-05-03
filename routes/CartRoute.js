const express = require("express")
const {
  GetCart,
  AddToCart,
  RemoveFromCart,
  ClearCart,
  // checkoutCart, // Make sure this matches the exported function name
} = require("../controllers/CartController")
const protect = require("../middlewares/AuthMiddle")

const router = express.Router()

router.get("/", protect, GetCart)
router.post("/add", protect, AddToCart)
router.delete("/remove", protect, RemoveFromCart)
router.delete("/clear", protect, ClearCart)
// router.get("/checkout", protect, checkoutCart) // This should now work

module.exports = router
