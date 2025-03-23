const slugify = require("slugify");
const asyncHandler = require("express-async-handler");
const fs = require("fs").promises; // Add fs.promises import
const CategoryModel = require("../models/category");
const ApiError = require("../utils/ApiError");
const ApiFeatures = require("../utils/ApiFeatures");

// Create Category - Private
const CreateCategory = asyncHandler(async (req, res) => {
  try {
    // Extract the category image path - fix the field name to match multer config
    const categoryImage =
      req.files && req.files["categoryImage"] && req.files["categoryImage"][0]
        ? req.files["categoryImage"][0].path.replace(/\\/g, "/")
        : "";

    // Create the category directly without checking for existing (handle that with unique index)
    const newCategory = await CategoryModel.create({
      name: req.body.name,
      slug: slugify(req.body.name || ""), // Provide default in case name is undefined
      categoryImage: categoryImage,
    });

    res.status(201).json({ status: "success", data: newCategory });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Get all Categories - Public
const GetAllCategories = asyncHandler(async (req, res) => {
  let query = CategoryModel.find();

  const features = new ApiFeatures(query, req.query)
    .filter("Category")
    .sort()
    .limitFields()
    .paginate();

  // Get the total count before pagination
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

  // Find the category
  const category = await CategoryModel.findById(id);
  if (!category) {
    return next(new ApiError(`No category with id: ${id}`, 404));
  }

  // Initialize update object with existing data
  const updateData = { ...req.body };

  // Handle image update if provided
  if (
    req.files &&
    req.files["categoryImage"] &&
    req.files["categoryImage"][0]
  ) {
    // Get new image path
    const newImagePath = req.files["categoryImage"][0].path.replace(/\\/g, "/");

    // Delete old image if it exists
    if (category.categoryImage) {
      try {
        await fs.unlink(category.categoryImage);
      } catch (error) {
        console.error(
          `Failed to delete old image: ${category.categoryImage}`,
          error
        );
      }
    }

    // Set the new image path
    updateData.categoryImage = newImagePath;
  }

  // Update slug if name is provided
  if (updateData.name) {
    updateData.slug = slugify(updateData.name);
  }

  // Update the category with the prepared data
  const updatedCategory = await CategoryModel.findByIdAndUpdate(
    id,
    updateData,
    { new: true }
  );

  res.status(200).json({ data: updatedCategory });
});

// Delete Category - Private
const DeleteCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const category = await CategoryModel.findById(id);
  if (!category) {
    return next(new ApiError(`No category with id: ${id}`, 404));
  }

  // Check for categoryImage and delete if it exists
  if (category.categoryImage) {
    try {
      await fs.unlink(category.categoryImage);
    } catch (error) {
      // Log the error but continue with deletion
      console.error(`Failed to delete image: ${category.categoryImage}`, error);
    }
  }

  await CategoryModel.findByIdAndDelete(id);

  res.status(204).json({ message: "Category Deleted Successfully" });
});

module.exports = {
  GetAllCategories,
  CreateCategory,
  GetCategory,
  UpdateCategory,
  DeleteCategory,
};
