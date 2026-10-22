
const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isSafeInteger,
      message: "Sale quantity must be a positive whole number.",
    },
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isFinite,
      message: "Unit price must be a finite number.",
    },
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isFinite,
      message: "Total amount must be a finite number.",
    },
  },
  soldAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports =
  mongoose.models.Sale ||
  mongoose.model("Sale", saleSchema);
