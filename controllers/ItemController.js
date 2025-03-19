const slugify = require("slugify");
const asyncHandler = require("express-async-handler");
const ItemModel = require("../models/Item");
const ApiFeatures = require("../utils/ApiFeatures");
const ApiError = require("../utils/ApiError");

// Create Item - Public / private
const CreateItem = asyncHandler(async (req, res) => {
  req.body.slug = slugify(req.body.title);
  const item = await ItemModel.create(req.body);
  res.status(201).json({ data: item });
});

// Get All Items - Public
const GetAllItems = asyncHandler(async (req, res) => {
  let query = ItemModel.find()
    .populate({ path: "category", select: "name" })
    .populate({ path: "subcategory", select: "name" });

  const features = new ApiFeatures(query, req.query)
    .filter("Item")
    .sort()
    .limitFields()
    .paginate();

  // 🛑 Get the total count before pagination
  const totalItems = await ItemModel.countDocuments(features.query.getFilter());

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
  const item = await ItemModel.findById(id)
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
  req.body.slug = slugify(req.body.title);
  const item = await ItemModel.findOneAndUpdate({ _id: id }, req.body, {
    new: true,
  });

  if (!item) {
    return next(new ApiError(`No item with id: ${id}`, 404));
  }
  res.status(200).json({ data: item });
});

// Delete Item - Public
const DeleteItem = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const item = await ItemModel.findByIdAndDelete(id);

  if (!item) {
    return next(new ApiError(`No item with id: ${id}`, 404));
  }
  res.status(204).json({ msg: "Item Deleted Successfully" });
});

module.exports = {
  CreateItem,
  GetAllItems,
  GetItem,
  DeleteItem,
  UpdateItem,
};
