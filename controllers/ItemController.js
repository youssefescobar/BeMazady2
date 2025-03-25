const slugify = require("slugify");
const asyncHandler = require("express-async-handler");
const fsPromises = require("fs/promises");
const mongoose = require("mongoose");
const Item = require("../models/Item");
const ApiFeatures = require("../utils/ApiFeatures");
const ApiError = require("../utils/ApiError");
const User = require("../models/User");

// Create Item - Public / private
const CreateItem = asyncHandler(async (req, res) => {
  try {
    const itemCover =
      req.files["item_cover"]?.[0]?.path.replace(/\\/g, "/") || "";
    const itemPictures =
      req.files["item_pictures"]?.map((file) =>
        file.path.replace(/\\/g, "/")
      ) || [];

    const newItem = await Item.create({
      title: req.body.title,
      item_status: req.body.item_status,
      description: req.body.description,
      price: req.body.price,
      is_featured: req.body.is_featured,
      item_cover: itemCover,
      item_pictures: itemPictures,
      category: req.body.category,
      subcategory: req.body.subcategory,
      ratingsAvg: req.body.ratingsAvg,
      slug: slugify(req.body.title),
    });

    res.status(201).json({ status: "success", data: newItem });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Get All Items - Public
const GetAllItems = asyncHandler(async (req, res) => {
  let query = Item.find()
    .populate({ path: "category", select: "name" })
    .populate({ path: "subcategory", select: "name" });

  const features = new ApiFeatures(query, req.query)
    .filter("Item")
    .sort()
    .limitFields()
    .paginate();

  // 🛑 Get the total count before pagination
  const totalItems = await Item.countDocuments(features.query.getFilter());

  // Apply pagination and get the items
  const items = await features.query;

  // Calculate total pages
  const limit = req.query.limit * 1 || 10;
  const totalPages = Math.ceil(totalItems / limit);

  res.status(200).json({
    results: items.length, // Number of items returned in this request
    totalItems, // Total number of items in the database matching the filters
    totalPages, // Total number of pages
    currentPage: req.query.page * 1 || 1, // Current page
    data: items,
  });
});

// Get specific Item - Public
const GetItem = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const item = await Item.findById(id)
    .populate({ path: "category", select: "name" })
    .populate({ path: "subcategory", select: "name" });

  if (!item) {
    return next(new ApiError(`No Item with id: ${id}`, 404));
  }
  res.status(200).json({ data: item });
});

// Update Item by id - Private
const UpdateItem = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const item = await Item.findById(id);
  if (!item) {
    return next(new ApiError(`No item with id: ${id}`, 404));
  }

  let newItemCover = item.item_cover;
  let newItemPictures = item.item_pictures;

  if (req.files) {
    if (req.files["item_cover"]) {
      newItemCover = req.files["item_cover"][0].path.replace(/\\/g, "/");
      if (item.item_cover)
        await fsPromises.unlink(item.item_cover).catch(() => {});
    }
    if (req.files["item_pictures"]) {
      newItemPictures = req.files["item_pictures"].map((file) =>
        file.path.replace(/\\/g, "/")
      );
      await Promise.all(
        item.item_pictures.map((pic) => fsPromises.unlink(pic).catch(() => {}))
      );
    }
  }

  req.body.item_cover = newItemCover;
  req.body.item_pictures = newItemPictures;
  req.body.slug = slugify(req.body.title);

  const updatedItem = await Item.findByIdAndUpdate(id, req.body, { new: true });
  res.status(200).json({ data: updatedItem });
});

// Delete Item - Public
const DeleteItem = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const item = await Item.findById(id);
  if (!item) {
    return next(new ApiError(`No item with id: ${id}`, 404));
  }

  if (item.item_cover) await fsPromises.unlink(item.item_cover).catch(() => {});
  await Promise.all(
    item.item_pictures.map((pic) => fsPromises.unlink(pic).catch(() => {}))
  );
  await Item.findByIdAndDelete(id);

  res.status(204).json({ message: "Item Deleted Successfully" });
});

const AddReview = asyncHandler(async (req, res) => {
  
});

const EditReview = asyncHandler(async (req, res, next) => {
  // Add defensive checks for userId
  if (!req.userId) {
    return next(new ApiError("User authentication failed", 401));
  }

  const { id } = req.params;
  const { rating, comment } = req.body;

  // Validate input
  if (!rating || !comment) {
    return next(new ApiError("Rating and comment are required", 400));
  }

  const item = await Item.findById(id);
  if (!item) {
    return next(new ApiError("Item not found", 404));
  }

  // Safer finding of review index
  const reviewIndex = item.reviews.findIndex(
    (review) =>
      review.user &&
      review.user.id &&
      review.user.id.toString() === req.userId.toString()
  );

  if (reviewIndex === -1) {
    return next(new ApiError("Review not found", 404));
  }

  // Update review
  item.reviews[reviewIndex].rating = rating;
  item.reviews[reviewIndex].comment = comment;

  // Recalculate ratingsAvg
  const totalRating = item.reviews.reduce(
    (acc, review) => acc + review.rating,
    0
  );
  item.ratingsAvg = totalRating / item.reviews.length;

  await item.save();
  res.status(200).json({
    message: "Review updated successfully",
    data: {
      item: item,
      review: item.reviews[reviewIndex],
    },
  });
});

const DeleteReview = asyncHandler(async (req, res, next) => {
  // Add defensive checks for userId
  if (!req.userId) {
    return next(new ApiError("User authentication failed", 401));
  }

  const { id } = req.params;

  const item = await Item.findById(id);
  if (!item) {
    return next(new ApiError("Item not found", 404));
  }

  // Safer finding of review index
  const reviewIndex = item.reviews.findIndex(
    (review) =>
      review.user &&
      review.user.id &&
      review.user.id.toString() === req.userId.toString()
  );

  if (reviewIndex === -1) {
    return next(new ApiError("Review not found", 404));
  }

  // Remove the review
  item.reviews.splice(reviewIndex, 1);

  // Recalculate ratingsAvg
  const totalRating = item.reviews.reduce(
    (acc, review) => acc + review.rating,
    0
  );
  item.ratingsAvg =
    item.reviews.length > 0 ? totalRating / item.reviews.length : 0;

  await item.save();
  res.status(200).json({
    message: "Review deleted successfully",
    data: item,
  });
});

const GetReviews = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const item = await Item.findById(id).select("reviews");
  if (!item) {
    return next(new ApiError(`No item found with ID: ${id}`, 404));
  }

  res.status(200).json({ data: item.reviews });
});
module.exports = {
  CreateItem,
  GetAllItems,
  GetItem,
  DeleteItem,
  UpdateItem,
  AddReview,
  EditReview,
  DeleteReview,
  GetReviews,
};
