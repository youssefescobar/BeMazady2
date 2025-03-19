const slugify = require("slugify");
const asyncHandler = require("express-async-handler");
const CategoryModel = require("../models/category");
const ApiError = require("../utils/ApiError");
const ApiFeatures = require("../utils/ApiFeatures");

// Create Category - Private
const CreateCategory = asyncHandler(async (req, res) => {
  const name = req.body.name;
  const category = await CategoryModel.create({ name, slug: slugify(name) });
  res.status(201).json({ data: category });
});

//Get all Categories - Public
const GetAllCategories = asyncHandler(async (req, res) => {
  let query = CategoryModel.find();

  const features = new ApiFeatures(query, req.query)
    .filter("Category")
    .sort()
    .limitFields()
    .paginate();

  //  Get the total count before pagination
  const totalCategories = await CategoryModel.countDocuments(
    features.query.getFilter()
  );

  // Apply pagination and get the categories
  const categories = await features.query;

  // Calculate total pages
  const limit = req.query.limit * 1 || 10;
  const totalPages = Math.ceil(totalCategories / limit);

  res.status(200).json({
    results: categories.length,
    totalCategories,
    totalPages,
    currentPage: req.query.page * 1 || 1,
    data: categories,
  });
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
