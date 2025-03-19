const slugify = require("slugify");
const asyncHandler = require("express-async-handler");
const ItemModel = require("../models/Item");
const ApiError = require("../utils/ApiError");

// Create Item - Public / private
const CreateItem = asyncHandler(async (req, res) => {
  req.body.slug = slugify(req.body.title);
  const item = await ItemModel.create(req.body);
  res.status(201).json({ data: item });
});

//Get all Items - Public
const GetAllItems = asyncHandler(async (req, res) => {
  const page = req.query.page * 1;
  const limit = req.query.limit * 1;
  const skip = (page - 1) * limit;
  const items = await ItemModel.find({})
    .skip(skip)
    .limit(limit)
    .populate({ path: "category", select: "name" });
  res.status(200).json({ results: items.length, page, data: items });
});

// Get specific Item - Public
const GetItem = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const items = await ItemModel.findById(id).populate({
    path: "category",
    select: "name",
  });
  if (!items) {
    return next(new ApiError(`No Item with id: ${id}`, 404));
  }
  res.status(200).json({ data: items });
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
  res.status(204).json({ msg: "Item Deleted Succesfully" });
});

module.exports = {
  CreateItem,
  GetAllItems,
  GetItem,
  DeleteItem,
  UpdateItem,
};
