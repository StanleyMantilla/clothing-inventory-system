
const mongoose = require("mongoose");

// Reuse the existing models from your application.
// Fall back to the existing model files if needed.
const Product =
  mongoose.models.Product || require("./Product");

const Sale =
  mongoose.models.Sale || require("./Sale");

module.exports = {
  Product,
  Sale,
};
