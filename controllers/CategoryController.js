const slugify = require("slugify");
const asyncHandler = require("express-async-handler");
const CategoryModel = require("../models/category");
const ApiError = require("../utils/ApiError");

// Create Category - Private
const CreateCategory = asyncHandler(async (req, res) => {
  const name = req.body.name;
  const category = await CategoryModel.create({ name, slug: slugify(name) });
  res.status(201).json({ data: category });
});

//Get all Categories - Public
const GetAllCategories = asyncHandler(async (req, res) => {
  const page = req.query.page * 1;
  const limit = req.query.limit * 1;
  const skip = (page - 1) * limit;
  const categories = await CategoryModel.find({}).skip(skip).limit(limit);
  res.status(200).json({ results: categories.length, page, data: categories });
});

// Get specific Category - Public
const GetCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const category = await CategoryModel.findById(id);
  if (!category) {
    return next(new ApiError(`No Category with id: ${id}`, 404));
  }
  res.status(200).json({ data: category });
});

// Update Category by id - Private
const UpdateCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const name = req.body.name;
  const category = await CategoryModel.findOneAndUpdate(
    { _id: id },
    { name: name, slug: slugify(name) },
    { new: true }
  );
  if (!category) {
    return next(new ApiError(`No Category with id: ${id}`, 404));
  }
  res.status(200).json({ data: category });
});

const DeleteCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const category = await CategoryModel.findByIdAndDelete(id);
  if (!category) {
    return next(new ApiError(`No Category with id: ${id}`, 404));
  }
  res.status(204).json({ msg: "Deleted Succesfully" });
});

module.exports = {
  GetAllCategories,
  CreateCategory,
  GetCategory,
  UpdateCategory,
  DeleteCategory,
};
