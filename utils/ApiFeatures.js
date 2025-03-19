const { modelName } = require("../models/Item");

class ApiFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  // 1️⃣ Filtering (with Search)
  filter(Modelname) {
    const queryObj = { ...this.queryString };
    const excludedFields = ["page", "sort", "limit", "fields", "keyword"];
    excludedFields.forEach((el) => delete queryObj[el]);

    // 🔍 Search: Check both title and description
    if (this.queryString.keyword) {
        if (Modelname === "Item") {
          queryObj.$or = [
            { title: { $regex: this.queryString.keyword, $options: "i" } },
            { description: { $regex: this.queryString.keyword, $options: "i" } },
          ];
        } else {
          queryObj.$or = [
            { name: { $regex: this.queryString.keyword, $options: "i" } }
          ];
        }
      }

    // Price Range Filtering
    if (queryObj.minPrice || queryObj.maxPrice) {
      queryObj.price = {};
      if (queryObj.minPrice) queryObj.price.$gte = queryObj.minPrice;
      if (queryObj.maxPrice) queryObj.price.$lte = queryObj.maxPrice;
      delete queryObj.minPrice;
      delete queryObj.maxPrice;
    }

    this.query = this.query.find(queryObj);
    return this;
  }

  // 2️⃣ Sorting
  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort("-createdAt");
    }
    return this;
  }

  // 3️⃣ Field Limiting
  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select("-__v");
    }
    return this;
  }

  // 4️⃣ Pagination
  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 10;
    const skip = (page - 1) * limit;
    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}

module.exports = ApiFeatures;
