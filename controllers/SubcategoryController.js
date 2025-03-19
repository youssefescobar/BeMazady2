const slugify = require("slugify");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const SubcategoryModel = require("../models/subcategory");

// Private
const CreateSubcategory = asyncHandler(async (req, res) => {
  const { name, category } = req.body;
  const subcategory = await SubcategoryModel.create({
    name: name,
    slug: slugify(name),
    category,
  });
  res.status(201).json({ data: subcategory });
});

// Public
const GetAllSubcategories = asyncHandler(async (req, res) => {
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 ;
  const skip = (page - 1) * limit;

  let filtered = {};
  if (req.params.categoryId) {
    filtered = {
      category: req.params.categoryId,
    };
  }
  const subcategory = await SubcategoryModel.find(filtered)
    .skip(skip)
    .limit(limit)
    .populate({ path: "category", select: "name" });
  res.status(200).json({
    result: subcategory.length,
    page: page,
    data: subcategory,
  });
});

// public
const GetSubcategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const subcategory = await SubcategoryModel.findById(id).populate({
    path: "category",
    select: "name",
  });
  if (!subcategory) {
    return next(new ApiError(`No Subcategory with id: ${id}`, 404));
  }
  res.status(200).json({ data: subcategory });
});

// private
const UpdateSubcategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name, category } = req.body;
  const subcategory = await SubcategoryModel.findOneAndUpdate(
    { _id: id },
    { name: name, slug: slugify(name), category: category },
    { new: true }
  );
  if (!subcategory) {
    return next(new ApiError(`No Subcategory with id: ${id}`, 404));
  }
  res.status(200).json({ data: subcategory });
});

//private
const DeleteSubcategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const category = await SubcategoryModel.findByIdAndDelete(id);
  if (!category) {
    return next(new ApiError(`No Subcategory with id: ${id}`, 404));
  }
  res.status(204).json({ msg: "Deleted Succesfully" });
});

module.exports = {
  CreateSubcategory,
  GetAllSubcategories,
  GetSubcategory,
  UpdateSubcategory,
  DeleteSubcategory,
};
