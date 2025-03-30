const  recommendItems  = require("../services/recommendation_system");

async function getRecommendations(req, res) {
  const { itemId } = req.params;
  try {
    const recommendations = await recommendItems(itemId);
    res.json(recommendations);
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports =  getRecommendations ;
