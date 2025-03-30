const express = require("express");
const router = express.Router();
const getRecommendations = require("../controllers/Recommend");


router.get("/:itemId", getRecommendations);

module.exports = router;
