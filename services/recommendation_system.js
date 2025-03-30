const natural = require("natural");
const cosineSimilarity = require("cosine-similarity");
const Item = require("../models/Item");
const subcategory = require("../models/subcategory");

async function recommendItems(itemId) {
  const items = await Item.find({})
    .populate("category", "name")
    .populate("subcategory", "name")
    .select("title category subcategory");

  const targetItem = items.find((item) => item._id.toString() === itemId);
  if (!targetItem) return [];

  // Initialize TF-IDF
  const tfidf = new natural.TfIdf();
  const documents = items.map((item) => {
    const categoryName = item.category?.name || "";
    const subcategoryName = item.subcategory?.name || "";

    const text = `${item.title} ${item.description} ${categoryName} ${subcategoryName}`;
    tfidf.addDocument(text);
    return text;
  });

  // Find the correct index of the target item
  const targetIndex = items.findIndex((item) => item._id.toString() === itemId);

  if (targetIndex === -1) return [];

  // Compute similarity
  const targetVector = [];
  tfidf.tfidfs(documents[targetIndex], (i, measure) => {
    targetVector[i] = measure;
  });

  const similarities = items
    .map((item, index) => {
      if (index === targetIndex) return null; // Skip self-comparison

      const itemVector = [];
      tfidf.tfidfs(documents[index], (i, measure) => {
        itemVector[i] = measure;
      });

      return {
        itemId: item._id,
        title: item.title,
        category: item.category,
        subcategory: item.subcategory,
        description: item.description,
        score: cosineSimilarity(targetVector, itemVector),
      };
    })
    .filter(Boolean);

  return similarities.sort((a, b) => b.score - a.score).slice(0, 5);
}

module.exports = recommendItems;
