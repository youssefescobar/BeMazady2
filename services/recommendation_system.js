const natural = require("natural");
const cosineSimilarity = require("cosine-similarity");
const Item = require("../models/Item");

async function recommendItems(itemId) {
  const items = await Item.find({})
    .populate("category", "name")
    .populate("subcategory", "name")
    .select("title category subcategory description price item_cover");

  const targetItem = items.find((item) => item._id.toString() === itemId);
  if (!targetItem) return [];

  const tfidf = new natural.TfIdf();
  const documents = items.map((item) => {
    const categoryName = item.category?.name || "";
    const subcategoryName = item.subcategory?.name || "";
    return `${item.title} ${item.description} ${categoryName} ${subcategoryName}`;
  });

  documents.forEach(doc => tfidf.addDocument(doc));

  const allTerms = new Set();
  tfidf.documents.forEach(doc => {
    Object.keys(doc).forEach(term => allTerms.add(term));
  });

  const allTermsArray = Array.from(allTerms);

  // Convert document index to vector based on all terms
  function getVector(index) {
    return allTermsArray.map(term => tfidf.tfidf(term, index));
  }

  const targetIndex = items.findIndex(item => item._id.toString() === itemId);
  if (targetIndex === -1) return [];

  const targetVector = getVector(targetIndex);

  const similarities = items
    .map((item, index) => {
      if (index === targetIndex) return null;

      const vector = getVector(index);
      return {
        itemId: item._id,
        title: item.title,
        category: item.category,
        subcategory: item.subcategory,
        description: item.description,
        item_cover: item.item_cover,
        price: item.price,
        score: cosineSimilarity(targetVector, vector),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return similarities;
}

module.exports = recommendItems;
